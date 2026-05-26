import {
  latest,
  safeStringify,
  sideEffectsEnabled,
  generateRandomID,
  registerVNodeCleanup,
} from "../utils/index.js"
import {
  $DEV_FILE_LINK,
  $HMR_ACCEPT,
  $INLINE_FN,
  $SIGNAL,
} from "../constants.js"
import { __DEV__, isBrowser } from "../env.js"
import { KiruError } from "../error.js"
import { node } from "../globals.js"
import { requestUpdate } from "../scheduler.js"
import { tracking } from "./tracking.js"
import type { SignalSubscriber } from "./types.js"
import type { HMRAccept } from "../hmr.js"

const $STATE = Symbol.for("kiru.signalState")

export type Signal<T> = {
  (): T
  peek(): T
  sneak(next: T): void
  set(next: T): void
  set(updater: (prev: T) => T): void
  subscribe(cb: (state: T, prevState?: T) => void): () => void
  notify(filter?: (sub: SignalSubscriber<any>) => boolean): void
  [$SIGNAL]: true
  displayName?: string
}

export type SignalState<T> = {
  [$SIGNAL]: true
  [$HMR_ACCEPT]?: HMRAccept<SignalState<any>>
  displayName?: string
  $subs: Set<SignalSubscriber<any>>
  $id: string
  $value: T
  $prevValue?: T
  $initialValue?: string
  __next?: SignalState<T>
  $isDisposed?: boolean
  notify: (filter?: (sub: SignalSubscriber) => boolean) => void
}

function resolveState<T>(state: SignalState<T>): SignalState<T> {
  return latest(state)
}

export function getSignalState<T>(sig: Signal<T>): SignalState<T> {
  return (sig as Signal<T> & { [$STATE]: SignalState<T> })[$STATE]
}

export function createSignalCallable<T>(state: SignalState<T>): Signal<T> {
  const read = (() => {
    const tgt = resolveState(state)
    SignalHelpers.entangle(tgt)
    return tgt.$value
  }) as Signal<T>

  read.peek = () => resolveState(state).$value

  read.sneak = (next: T) => {
    const tgt = resolveState(state)
    tgt.$prevValue = tgt.$value
    tgt.$value = next
  }

  read.set = ((next: T | ((prev: T) => T)) => {
    const tgt = resolveState(state)
    const resolved =
      typeof next === "function" ? (next as (prev: T) => T)(tgt.$value) : next
    if (Object.is(tgt.$value, resolved)) return
    tgt.$prevValue = tgt.$value
    tgt.$value = resolved
    tgt.notify()
  }) as Signal<T>["set"]

  read.subscribe = (cb) => {
    const tgt = resolveState(state)
    if (__DEV__ && tgt.$isDisposed) {
      const name = tgt.displayName ?? tgt.$id
      let message = `Attempted to subscribe to a signal that has been disposed: ${name}`
      if ($DEV_FILE_LINK in tgt) {
        message += `\nFile: ${tgt[$DEV_FILE_LINK]}`
      }
      message += `\nInitial value: ${tgt.$initialValue}`
      throw new Error(message)
    }
    tgt.$subs.add(cb)
    return () => tgt.$subs.delete(cb)
  }

  read.notify = (filter?) => {
    resolveState(state).notify(filter)
  }

  read[$SIGNAL] = true
  if (state.displayName) read.displayName = state.displayName
  read.toString = () => {
    SignalHelpers.entangle(state)
    return `${resolveState(state).$value}`
  }
  ;(read as Signal<T> & { [$STATE]: SignalState<T> })[$STATE] = state

  return read
}

export function createSignalState<T>(
  initial: T,
  displayName?: string,
  onDispose?: (sig: Signal<T>) => void
): SignalState<T> {
  const state: SignalState<T> = {
    [$SIGNAL]: true,
    $id: generateRandomID(),
    $value: initial,
    $subs: new Set(),
    displayName,
    notify(filter?: (sub: SignalSubscriber) => boolean) {
      const tgt = resolveState(state)
      tgt.$subs.forEach((sub) => {
        if (filter && !filter(sub)) return
        return sub(tgt.$value, tgt.$prevValue)
      })
    },
  }

  if (__DEV__) {
    state.$initialValue = safeStringify(initial)
    state[$HMR_ACCEPT] = {
      provide: () => state,
      inject: (prev) => {
        if (isBrowser)
          window.__kiru.devtools?.untrack(createSignalCallable(prev))
        state.$id = prev.$id
        state.$subs = prev.$subs
        prev.__next = state
        if (state.$initialValue === prev.$initialValue) {
          state.$value = prev.$value
        } else {
          state.notify()
        }
      },
      destroy: () => {},
    } satisfies HMRAccept<SignalState<any>>
  }

  const n = node.current
  if (n) {
    if (__DEV__ && n.type === $INLINE_FN) {
      throw new KiruError({
        message: "Signals cannot be created inside inline functions",
        vNode: n,
      })
    }
    if (sideEffectsEnabled()) {
      registerVNodeCleanup(n, state.$id, () => {
        if (onDispose) onDispose(createSignalCallable(state))
        else SignalHelpers.disposeState(state)
      })
    }
  }

  return state
}

export function isSignal(x: unknown): x is Signal<any> {
  return typeof x === "function" && !!x && $SIGNAL in x
}

export const SignalHelpers = {
  id(sig: Signal<any>) {
    return getSignalState(sig).$id
  },

  subscribers(sig: Signal<any>) {
    return getSignalState(sig).$subs
  },

  entangle<T>(sig: Signal<T> | SignalState<T>) {
    if (tracking.enabled === false) return
    const state = (
      isSignal(sig) ? getSignalState(sig) : sig
    ) as SignalState<T>
    const tgt = resolveState(state)

    const vNode = node.current
    const trackedSignalObservations = tracking.current()
    if (trackedSignalObservations) {
      if (!vNode || (vNode && sideEffectsEnabled())) {
        trackedSignalObservations.set(
          tgt.$id,
          createSignalCallable(tgt) as Signal<unknown>
        )
      }
      return
    }
    if (!vNode || !sideEffectsEnabled()) return
    const callable = createSignalCallable(tgt)
    const unsub = callable.subscribe(() => requestUpdate(vNode))
    ;(vNode.subs ??= new Set()).add(unsub)
  },

  dispose(sig: Signal<any>) {
    SignalHelpers.disposeState(getSignalState(sig), sig)
  },

  disposeState(state: SignalState<any>, sig?: Signal<any>) {
    if (state.$isDisposed) return
    state.$isDisposed = true
    if (__DEV__) {
      if (sig && isBrowser) window.__kiru.devtools?.untrack(sig)
      return
    }
    state.$subs.clear()
  },
}

export const signal = <T>(initial: T, displayName?: string): Signal<T> => {
  const state = createSignalState(initial, displayName)
  return createSignalCallable(state)
}

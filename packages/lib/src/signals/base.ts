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

export class Signal<T> {
  [$SIGNAL] = true;
  [$HMR_ACCEPT]?: HMRAccept<Signal<any>>
  displayName?: string
  protected $subs: Set<SignalSubscriber<any>>
  protected $id: string
  protected $value: T
  protected $prevValue?: T
  protected $initialValue?: string
  protected __next?: Signal<T>
  protected $isDisposed?: boolean

  constructor(initial: T, displayName?: string) {
    this.$id = generateRandomID()
    this.$value = initial
    this.$subs = new Set()
    if (displayName) this.displayName = displayName

    if (__DEV__) {
      this.$initialValue = safeStringify(initial)
      this[$HMR_ACCEPT] = {
        provide: () => {
          return this as Signal<any>
        },
        inject: (prev) => {
          if (isBrowser) window.__kiru.devtools?.untrack(prev)
          this.$id = prev.$id
          this.$subs = prev.$subs
          // this is a nice-to-have so that implementations of signal-on-signal don't need to do it themselves.
          // eg. Object.assign(signal, { nestedSignal })
          // it's only done by our HMR pass for top-level signals.
          prev.__next = this

          if (this.$initialValue === prev.$initialValue) {
            this.$value = prev.$value
          } else {
            this.notify()
          }
        },
        destroy: () => {},
      } satisfies HMRAccept<Signal<any>>
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
        registerVNodeCleanup(n, this.$id, Signal.dispose.bind(null, this))
      }
    }
  }

  get value() {
    if (__DEV__) {
      const tgt = latest(this)
      Signal.entangle(tgt)
      return tgt.$value
    }
    Signal.entangle(this)
    return this.$value
  }

  set value(next: T) {
    if (__DEV__) {
      const tgt = latest(this)
      if (Object.is(tgt.$value, next)) return
      tgt.$prevValue = tgt.$value
      tgt.$value = next
      tgt.notify()
      return
    }
    if (Object.is(this.$value, next)) return
    this.$prevValue = this.$value
    this.$value = next
    this.notify()
  }

  peek() {
    if (__DEV__) {
      return latest(this).$value
    }
    return this.$value
  }

  sneak(newValue: T) {
    if (__DEV__) {
      const tgt = latest(this)
      tgt.$prevValue = tgt.$value
      tgt.$value = newValue
      return
    }
    this.$prevValue = this.$value
    this.$value = newValue
  }

  toString() {
    if (__DEV__) {
      const tgt = latest(this)
      Signal.entangle(tgt)
      return `${tgt.$value}`
    }
    Signal.entangle(this)
    return `${this.$value}`
  }

  subscribe(cb: (state: T, prevState?: T) => void): () => void {
    if (__DEV__) {
      const tgt = latest(this)
      if (__DEV__ && tgt.$isDisposed) {
        const name = tgt.displayName ?? tgt.$id
        let message = `Attempted to subscribe to a signal that has been disposed: ${name}`
        if ($DEV_FILE_LINK in tgt) {
          message += `\nFile: ${tgt[$DEV_FILE_LINK]}`
        }
        message += `\nInitial value: ${tgt.$initialValue}`
        throw new Error(message)
      }
    }
    this.$subs.add(cb)
    return () => this.$subs.delete(cb)
  }

  notify(filter?: (sub: SignalSubscriber) => boolean) {
    if (__DEV__) {
      const tgt = latest(this)
      return tgt.$subs.forEach((sub) => {
        if (filter && !filter(sub)) return
        const { $value, $prevValue } = latest(this)
        return sub($value, $prevValue)
      })
    }
    this.$subs.forEach((sub) => {
      if (filter && !filter(sub)) return
      return sub(this.$value, this.$prevValue)
    })
  }

  static isSignal(x: any): x is Signal<any> {
    return typeof x === "object" && !!x && $SIGNAL in x
  }

  static id(signal: Signal<any>) {
    return signal.$id
  }

  static subscribers(signal: Signal<any>) {
    return signal.$subs
  }

  static entangle<T>(signal: Signal<T>) {
    if (tracking.enabled === false) return
    if (__DEV__) signal = latest(signal)

    const vNode = node.current
    const trackedSignalObservations = tracking.current()
    if (trackedSignalObservations) {
      // track non-rendering access, only track rendering access if renderMode is DOM/hydrate
      if (!vNode || (vNode && sideEffectsEnabled())) {
        trackedSignalObservations.set(signal.$id, signal)
      }
      return
    }
    if (!vNode || !sideEffectsEnabled()) return
    const unsub = signal.subscribe(() => requestUpdate(vNode))
    ;(vNode.subs ??= new Set()).add(unsub)
  }

  static dispose(signal: Signal<any>) {
    if (signal.$isDisposed) return

    signal.$isDisposed = true
    if (__DEV__) {
      if (isBrowser) window.__kiru.devtools?.untrack(latest(signal))
      return
    }
    signal.$subs.clear()
  }
}

export const signal = <T>(initial: T, displayName?: string) => {
  return new Signal(initial, displayName)
}

import { __DEV__ } from "../env.js"
import { $HMR_ACCEPT, $SIGNAL } from "../constants.js"
import { call, latest } from "../utils/index.js"
import { effectQueue } from "./globals.js"
import { executeWithTracking } from "./tracking.js"
import {
  SignalHelpers,
  createSignalCallable,
  createSignalState,
  getSignalState,
  type Signal as SignalFn,
  type SignalState,
} from "./base.js"
import type { HMRAccept } from "../hmr.js"

export type ComputedSignalState<T> = SignalState<T> & {
  $getter: (prev?: T) => T
  $unsubs: Map<string, Function>
  $isDirty: boolean
}

export type ComputedSignal<T> = SignalFn<T>

function stopComputed<T>(state: ComputedSignalState<T>) {
  if (__DEV__) {
    state = latest(state)
  }
  const { $id, $unsubs } = state
  effectQueue.delete($id)
  $unsubs.forEach(call)
  $unsubs.clear()
  state.$isDirty = true
}

function runComputed<T>(state: ComputedSignalState<T>) {
  if (__DEV__) {
    state = latest(state)
  }
  const { $id: id, $getter, $unsubs: subs } = state

  const value = executeWithTracking({
    id,
    subs,
    fn: () => $getter(state.$value),
    onDepChanged: () => {
      state.$isDirty = true
      if (!state.$subs.size) return
      runComputed(state)
      if (Object.is(state.$value, state.$prevValue)) return
      state.notify()
    },
  })
  state.$prevValue = state.$value
  state.$value = value
  state.$isDirty = false
}

function ensureNotDirty<T>(state: ComputedSignalState<T>) {
  let computed = state
  if (__DEV__) {
    computed = latest(state)
  }

  if (!computed.$isDirty) {
    const pending = effectQueue.get(computed.$id)
    if (pending) {
      pending()
      effectQueue.delete(computed.$id)
    }
  }

  if (!computed.$isDirty) return
  if (__DEV__ && computed.$isDisposed) return
  runComputed(computed)
}

function wrapComputedCallable<T>(
  state: ComputedSignalState<T>
): ComputedSignal<T> {
  const base = createSignalCallable(state)

  const read = (() => {
    ensureNotDirty(state)
    SignalHelpers.entangle(state)
    return (__DEV__ ? latest(state) : state).$value
  }) as ComputedSignal<T>

  read.peek = () => {
    ensureNotDirty(state)
    return (__DEV__ ? latest(state) : state).$value
  }

  read.sneak = base.sneak
  read.set = base.set
  read.notify = base.notify
  read.subscribe = (cb) => {
    if (state.$isDirty) runComputed(state)
    return base.subscribe(cb)
  }

  read.toString = () => {
    ensureNotDirty(state)
    SignalHelpers.entangle(state)
    return `${(__DEV__ ? latest(state) : state).$value}`
  }

  read[$SIGNAL] = true
  if (state.displayName) read.displayName = state.displayName
  ;(read as ComputedSignal<T> & { [k: symbol]: ComputedSignalState<T> })[
    Symbol.for("kiru.signalState")
  ] = state

  return read
}

export const ComputedSignal = {
  dispose(sig: ComputedSignal<any>) {
    stopComputed(getSignalState(sig) as ComputedSignalState<any>)
    SignalHelpers.dispose(sig)
  },
}

export function computed<T>(
  getter: (prev?: T) => T,
  displayName?: string
): ComputedSignal<T> {
  const state = createSignalState(undefined as T, displayName, (callable) =>
    ComputedSignal.dispose(callable as ComputedSignal<T>)
  ) as ComputedSignalState<T>

  state.$getter = getter
  state.$unsubs = new Map()
  state.$isDirty = true

  if (__DEV__) {
    const { inject: baseInject } = state[$HMR_ACCEPT]!
    state[$HMR_ACCEPT] = {
      provide: () => state,
      inject: (prev: ComputedSignalState<T>) => {
        baseInject(prev)
        stopComputed(prev)
        state.$isDirty = true
        runComputed(state)
        state.notify()
      },
      destroy: () => {},
    } as unknown as HMRAccept<SignalState<any>>
  }

  return wrapComputedCallable(state)
}

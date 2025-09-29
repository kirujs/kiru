import type { Prettify } from "./types.utils.js"
import { __DEV__ } from "./env.js"
import { useHook } from "./hooks/utils.js"
import { $HMR_ACCEPT } from "./constants.js"
import { HMRAccept } from "./hmr.js"
import {
  safeStringify,
  shallowCompare,
  sideEffectsEnabled,
} from "./utils/index.js"

export { createStore }
export type { Store, MethodFactory }

type MethodFactory<T> = (
  setState: (setter: Kiru.StateSetter<T>) => void,
  getState: () => T
) => Record<string, Function>

type StoreHook<T, U extends Record<string, Function>> = {
  <R>(sliceFn: (state: T) => R): Prettify<{ value: R } & U>
  <
    F extends null | ((state: T) => unknown),
    R extends F extends Function ? ReturnType<F> : T
  >(
    sliceFn: F,
    equality: (prev: R, next: R, compare: typeof shallowCompare) => boolean
  ): Prettify<{ value: R } & U>
  (): Prettify<{ value: T } & U>
}

type Subscribe<T> = {
  (fn: (value: T) => void): () => void
  <R>(sliceFn: (value: T) => R, fn: (value: R) => void): () => void
}

type Store<T, U extends Record<string, Function>> = StoreHook<T, U> & {
  getState: () => T
  setState: (setter: Kiru.StateSetter<T>) => void
  methods: U
  subscribe: Subscribe<T>
}

type NodeState = {
  update: () => void
  slices: {
    sliceFn: Function | null
    eq:
      | ((prev: any, next: any, compare: typeof shallowCompare) => boolean)
      | undefined
    value: any
  }[]
}

type InternalStoreState<T, U extends MethodFactory<T>> = {
  value: T
  epoch: number
  subscribers: Set<Kiru.VNode | Function>
  nodeStateMap: WeakMap<Kiru.VNode, NodeState>
  methods: ReturnType<U>
}

function createStore<T, U extends MethodFactory<T>>(
  initial: T,
  methodFactory: U
): Store<T, ReturnType<U>> {
  const state = {
    $initial: null as string | null,
    current: {
      value: initial,
      epoch: 0,
      subscribers: new Set<Kiru.VNode | Function>(),
      nodeStateMap: new WeakMap<Kiru.VNode, NodeState>(),
      methods: null as any as ReturnType<U>,
    } satisfies InternalStoreState<T, U>,
  }
  if (__DEV__) {
    state.$initial = safeStringify(initial)
  }

  const getState = () => state.current.value

  const setState = (setter: Kiru.StateSetter<T>) => {
    state.current.value =
      typeof setter === "function"
        ? (setter as Function)(state.current.value)
        : setter

    const { value, subscribers, nodeStateMap } = state.current

    subscribers.forEach((n) => {
      if (typeof n === "function") return n(value)
      const nodeState = nodeStateMap.get(n)
      if (!nodeState) return
      const { slices, update } = nodeState
      let computeChanged = slices.length === 0

      for (let i = 0; i < slices.length; i++) {
        const slice = slices[i]
        if (!slice) continue
        const { sliceFn, eq, value: sliceVal } = slice
        const newSliceVal = sliceFn === null ? value : sliceFn(value)
        slices[i] = { sliceFn, eq, value: newSliceVal }

        if (computeChanged) continue
        if (eq && eq(sliceVal, newSliceVal, shallowCompare)) {
          continue
        } else if (!eq && shallowCompare(sliceVal, newSliceVal)) {
          continue
        }

        computeChanged = true
      }
      if (computeChanged) {
        update()
      }
    })
    state.current.epoch++
  }
  state.current.methods = methodFactory(setState, getState) as ReturnType<U>

  function useStore<R>(
    sliceFn: null | ((state: T) => R) = null,
    equality?: (prev: R, next: R, compare: typeof shallowCompare) => boolean
  ) {
    if (!sideEffectsEnabled()) {
      return {
        value: sliceFn ? sliceFn(state.current.value) : state.current.value,
        ...state.current.methods,
      }
    }
    return useHook(
      "useStore",
      { value: null as any as T | R, lastChangeSync: -1 },
      ({ hook, isInit, isHMR, vNode, index, update }) => {
        if (__DEV__) {
          if (isInit) {
            hook.dev = {
              devtools: {
                get: () => ({ value: hook.value }),
              },
              initialArgs: [sliceFn, equality],
            }
          }
          if (isHMR) {
            const [fn, eq] = hook.dev!.initialArgs
            if (fn !== sliceFn || eq !== equality) {
              isInit = true
              hook.dev!.initialArgs = [sliceFn, equality]
            }
          }
        }
        const { subscribers, nodeStateMap, epoch, value, methods } =
          state.current

        const nodeState = nodeStateMap.get(vNode) ?? {
          slices: [],
          update,
        }
        let slice: (typeof nodeState.slices)[number]
        if (isInit || !nodeState.slices[index]) {
          subscribers.add(vNode)
          hook.lastChangeSync = epoch
          hook.value = sliceFn === null ? value : sliceFn(value)
          slice = nodeState.slices[index] = {
            sliceFn,
            eq: equality,
            value: hook.value,
          }
          nodeStateMap.set(vNode, nodeState)

          hook.cleanup = () => {
            nodeStateMap.delete(vNode)
            subscribers.delete(vNode)
          }
        } else {
          slice = nodeState.slices[index]
          if (slice.sliceFn !== sliceFn) {
            slice.value = hook.value = sliceFn ? sliceFn(value) : value
            slice.sliceFn = sliceFn
          }
          slice.eq = equality
        }

        if (hook.lastChangeSync !== epoch) {
          hook.value = slice ? slice.value : state.current.value
          hook.lastChangeSync = epoch
        }

        return { value: hook.value, ...methods }
      }
    )
  }

  const store = Object.assign(useStore, {
    get getState() {
      return getState
    },
    get setState() {
      return setState
    },
    get methods() {
      return { ...state.current.methods }
    },
    subscribe: ((sliceOrCb, cb) => {
      if (cb === undefined) {
        state.current.subscribers.add(sliceOrCb)
        return () => (state.current.subscribers.delete(sliceOrCb), void 0)
      }

      const selection = {
        current: null as ReturnType<typeof sliceOrCb> | null,
      }
      const sliceWrapper = (newState: T) => {
        const next = sliceOrCb(newState)
        if (shallowCompare(next, selection.current)) return
        selection.current = next
        cb(next)
      }
      state.current.subscribers.add(sliceWrapper)
      return () => (state.current.subscribers.delete(sliceWrapper), void 0)
    }) as Subscribe<T>,
  })

  if (__DEV__) {
    return Object.assign(store, {
      [$HMR_ACCEPT]: {
        provide: () => state,
        inject: (prev) => {
          state.current = prev.current
          state.current.methods = methodFactory(
            setState,
            getState
          ) as ReturnType<U>
          if (state.$initial !== prev.$initial) {
            setState(initial)
          }
        },
        destroy: () => {},
      } satisfies HMRAccept<typeof state>,
    })
  }

  return store
}

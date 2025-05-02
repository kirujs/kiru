import type { Prettify } from "./types.utils.js"
import { __DEV__ } from "./env.js"
import { sideEffectsEnabled, useHook } from "./hooks/utils.js"
import { safeStringify, shallowCompare } from "./utils.js"
import { $HMR_ACCEPT } from "./constants.js"
import { HMRAccept } from "./hmr.js"

export { createStore }
export type { Store, MethodFactory }

type MethodFactory<T> = (
  setState: (setter: Kaioken.StateSetter<T>) => void,
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

type Store<T, U extends Record<string, Function>> = StoreHook<T, U> & {
  getState: () => T
  setState: (setter: Kaioken.StateSetter<T>) => void
  methods: U
  subscribe: (fn: (value: T) => void) => () => void
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
  subscribers: Set<Kaioken.VNode | Function>
  nodeStateMap: WeakMap<Kaioken.VNode, NodeState>
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
      subscribers: new Set<Kaioken.VNode | Function>(),
      nodeStateMap: new WeakMap<Kaioken.VNode, NodeState>(),
      methods: null as any as ReturnType<U>,
    } satisfies InternalStoreState<T, U>,
  }
  if (__DEV__) {
    state.$initial = safeStringify(initial)
  }

  const getState = () => state.current.value

  const setState = (setter: Kaioken.StateSetter<T>) => {
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
      ({ hook, isInit, vNode, index, update }) => {
        if (__DEV__) {
          hook.dev = {
            devtools: {
              get: () => ({ value: hook.value }),
            },
          }
        }
        const { subscribers, nodeStateMap, epoch, value, methods } =
          state.current

        if (isInit) {
          subscribers.add(vNode)
          const nodeState = nodeStateMap.get(vNode) ?? {
            slices: [],
            update,
          }

          hook.lastChangeSync = epoch
          hook.value = sliceFn === null ? value : sliceFn(value)

          if (sliceFn || equality) {
            nodeState.slices[index] = {
              sliceFn,
              eq: equality,
              value: hook.value,
            }
          }
          nodeStateMap.set(vNode, nodeState)

          hook.cleanup = () => {
            nodeStateMap.delete(vNode)
            subscribers.delete(vNode)
          }
        }

        if (hook.lastChangeSync !== epoch) {
          const currentSlice = nodeStateMap.get(vNode)?.slices[index]

          hook.value = currentSlice ? currentSlice.value : state.current.value
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
    subscribe: (fn: (state: T) => void) => {
      state.current.subscribers.add(fn)
      return (() => (
        state.current.subscribers.delete(fn), void 0
      )) as () => void
    },
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

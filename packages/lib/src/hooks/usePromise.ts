import { __DEV__ } from "../env.js"
import { hydrationMode, renderMode } from "../globals.js"
import { Signal, useSignal } from "../signals/base.js"
import { depsRequireChange, useHook } from "./utils.js"
import { useId } from "./useId.js"
import {
  createStatefulPromise,
  resolveStreamedPromise,
} from "../utils/promise.js"

export { usePromise }

const nodeToPromiseIndex = new WeakMap<Kiru.VNode, number>()

type PromiseMutator = (signal: AbortSignal) => unknown | Promise<unknown>

type UsePromiseResult<T> = Kiru.StatefulPromise<T> & {
  refresh: (mutator?: PromiseMutator) => void
  isPending: Signal<boolean>
}

function usePromise<T>(
  callback: (signal: AbortSignal) => Promise<T>,
  deps: unknown[]
): UsePromiseResult<T> {
  const vNodeId = useId()
  const isPending = useSignal(true)

  return useHook(
    "usePromise",
    {} as {
      promise: UsePromiseResult<T>
      abortController?: AbortController
      deps?: unknown[]
      refresh: (mutator?: PromiseMutator) => void
      promiseId: string
      epoch: number
    },
    ({ hook, isInit, vNode, update }) => {
      if (isInit) {
        hook.epoch = 0
        hook.cleanup = () => hook.abortController?.abort("aborted")

        const index = nodeToPromiseIndex.get(vNode) ?? 0
        nodeToPromiseIndex.set(vNode, index + 1)
        const promiseId = (hook.promiseId = `${vNodeId}:data:${index}`)

        const refresh = (hook.refresh = (mutator?: PromiseMutator) => {
          if (typeof mutator !== "function") {
            delete hook.deps
            return update()
          }

          hook.cleanup!()
          const signal = (hook.abortController = new AbortController()).signal
          const promise = Promise.try(mutator, signal).then(() =>
            callback(signal)
          )
          const epoch = ++hook.epoch
          hook.promise = createStatefulPromise(
            promiseId,
            promise,
            { isPending, refresh },
            () => epoch === hook.epoch && (isPending.value = false)
          )

          isPending.value = true
          update()
        })
      }

      if (isInit || depsRequireChange(deps, hook.deps)) {
        isPending.value = true
        hook.deps = deps
        hook.cleanup!()

        const signal = (hook.abortController = new AbortController()).signal
        const { promiseId, refresh } = hook

        let promise: Promise<T>
        if (renderMode.current === "string") {
          // if we're rendering to string, there's no need to fire the callback
          promise = Promise.resolve() as Promise<T>
        } else if (
          renderMode.current === "hydrate" &&
          hydrationMode.current === "dynamic"
        ) {
          // if we're hydrating and the hydration mode is not static,
          // we need to resolve the promise from cache/event
          promise = resolveStreamedPromise<T>(promiseId, signal)
        } else {
          // dom / stream / (hydrate + static)
          promise = callback(signal)
        }

        const epoch = ++hook.epoch
        hook.promise = createStatefulPromise(
          promiseId,
          promise,
          { isPending, refresh },
          () => epoch === hook.epoch && (isPending.value = false)
        )
      }
      return hook.promise
    }
  )
}

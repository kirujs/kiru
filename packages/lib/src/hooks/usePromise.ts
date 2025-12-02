import { __DEV__ } from "../env.js"
import { hydrationMode, renderMode } from "../globals.js"
import { Signal, useSignal } from "../signals/base.js"
import { cleanupHook, depsRequireChange, useHook } from "./utils.js"
import { useId } from "./useId.js"
import {
  createStatefulPromise,
  resolveStreamedPromise,
} from "../utils/promise.js"

export { usePromise }

const nodeToPromiseIndex = new WeakMap<Kiru.VNode, number>()

type UsePromiseResult<T> = Kiru.StatefulPromise<T> & {
  refresh: () => void
  isPending: Signal<boolean>
}

function usePromise<T>(
  callback: (signal: AbortSignal) => Promise<T>,
  deps: unknown[]
): UsePromiseResult<T> {
  const id = useId()
  const isPending = useSignal(true)

  return useHook(
    "usePromise",
    {} as {
      promise: UsePromiseResult<T>
      abortController?: AbortController
      deps?: unknown[]
    },
    ({ hook, isInit, vNode, update }) => {
      if (isInit || depsRequireChange(deps, hook.deps)) {
        isPending.value = true
        hook.deps = deps
        cleanupHook(hook)

        const controller = (hook.abortController = new AbortController())
        hook.cleanup = () => controller.abort("aborted")

        const index = nodeToPromiseIndex.get(vNode) ?? 0
        nodeToPromiseIndex.set(vNode, index + 1)

        const promiseId = `${id}:data:${index}`

        let promise: Promise<T>
        if (renderMode.current === "string") {
          // if we're rendering to a string, there's no need to fire the callback
          promise = Promise.resolve() as Promise<T>
        } else if (
          renderMode.current === "hydrate" &&
          hydrationMode.current === "dynamic"
        ) {
          // if we're hydrating and the hydration mode is not static,
          // we need to resolve the promise from cache/event
          promise = resolveStreamedPromise<T>(promiseId, controller.signal)
        } else {
          // dom / stream / (hydrate + static)
          promise = callback(controller.signal)
        }

        const p = (hook.promise = Object.assign(
          createStatefulPromise(promiseId, promise),
          {
            isPending,
            refresh: () => {
              delete hook.deps
              update()
            },
          }
        ))

        p.finally(() => {
          isPending.value = false
        })
      }
      return hook.promise
    }
  )
}

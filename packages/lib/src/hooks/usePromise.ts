import { STREAMED_DATA_EVENT } from "../constants.js"
import { __DEV__ } from "../env.js"
import { hydrationMode, renderMode } from "../globals.js"
import { Signal, useSignal } from "../signals/base.js"
import { cleanupHook, depsRequireChange, useHook } from "./utils.js"
import { useId } from "./useId.js"

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
        hook.cleanup = () => controller.abort()

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
          promise = resolveDeferredPromise<T>(promiseId, controller.signal)
        } else {
          // dom / stream / (hydrate + static)
          promise = callback(controller.signal)
        }

        const state: Kiru.PromiseState<T> = { id: promiseId, state: "pending" }
        const statefulPromise: Kiru.StatefulPromise<T> = (hook.promise =
          Object.assign(promise, state, {
            isPending,
            refresh: () => {
              hook.deps = undefined
              update()
            },
          }))

        statefulPromise
          .then((value) => {
            statefulPromise.state = "fulfilled"
            statefulPromise.value = value
            isPending.value = false
          })
          .catch((error) => {
            statefulPromise.state = "rejected"
            statefulPromise.error =
              error instanceof Error ? error : new Error(error)
          })
      }
      return hook.promise
    }
  )
}

interface DeferredPromiseEventDetail<T> {
  id: string
  data?: T
  error?: string
}

function resolveDeferredPromise<T>(
  id: string,
  signal: AbortSignal
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const deferralCache: Map<string, { data?: T; error?: string }> = // @ts-ignore
      (window[STREAMED_DATA_EVENT] ??= new Map())

    const existing = deferralCache.get(id)
    if (existing) {
      const { data, error } = existing
      deferralCache.delete(id)
      if (error) return reject(error)
      return resolve(data!)
    }

    const onDataEvent = (event: Event) => {
      const { detail } = event as CustomEvent<DeferredPromiseEventDetail<T>>
      if (detail.id === id) {
        deferralCache.delete(id)
        window.removeEventListener(STREAMED_DATA_EVENT, onDataEvent)
        const { data, error } = detail
        if (error) return reject(error)
        resolve(data!)
      }
    }

    window.addEventListener(STREAMED_DATA_EVENT, onDataEvent)
    signal.addEventListener("abort", () => {
      window.removeEventListener(STREAMED_DATA_EVENT, onDataEvent)
      reject()
    })
  })
}

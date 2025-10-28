import { PREFETCHED_DATA_EVENT } from "../constants.js"
import { __DEV__ } from "../env.js"
import { renderMode } from "../globals.js"
import { requestUpdate } from "../scheduler.js"
import { Signal, useSignal } from "../signals/base.js"
import { cleanupHook, depsRequireChange, useHook } from "./utils.js"
import { useId } from "./useId.js"

export { usePromise }
export type { UsePromiseCallbackContext, UsePromiseState }

const nodeToPromiseIndex = new WeakMap<Kiru.VNode, number>()

interface UsePromiseCallbackContext {
  signal: AbortSignal
}

interface UsePromiseState<T> {
  data: Kiru.StatefulPromise<T>
  refresh: () => void
  pending: Signal<boolean>
}

function usePromise<T>(
  callback: (ctx: UsePromiseCallbackContext) => Promise<T>,
  deps: unknown[]
): UsePromiseState<T> {
  const id = useId()
  const pending = useSignal(true)

  return useHook(
    "usePromise",
    {} as {
      promise: Kiru.StatefulPromise<T>
      abortController?: AbortController
      deps?: unknown[]
    },
    ({ hook, isInit, vNode }) => {
      if (isInit || depsRequireChange(deps, hook.deps)) {
        pending.value = true
        hook.deps = deps
        cleanupHook(hook)

        const controller = (hook.abortController = new AbortController())
        hook.cleanup = () => controller.abort()

        const index = nodeToPromiseIndex.get(vNode) ?? 0
        nodeToPromiseIndex.set(vNode, index + 1)

        const promiseId = `${id}:data:${index}`
        const state: Kiru.PromiseState<T> = { id: promiseId, state: "pending" }
        const promise =
          renderMode.current === "hydrate"
            ? resolvePrefetchedPromise<T>(promiseId, controller.signal)
            : callback({ signal: controller.signal })

        const p = (hook.promise = Object.assign(promise, state))
        p.then((value) => {
          p.state = "fulfilled"
          p.value = value
        })
          .catch((error) => {
            p.state = "rejected"
            p.error = error instanceof Error ? error : new Error(error)
          })
          .finally(() => {
            pending.value = false
          })
      }
      return {
        data: hook.promise,
        refresh: () => {
          hook.deps = undefined
          requestUpdate(vNode)
        },
        pending,
      }
    }
  )
}

interface PrefetchedPromiseEventDetail<T> {
  id: string
  data?: T
  error?: string
}

function resolvePrefetchedPromise<T>(
  id: string,
  signal: AbortSignal
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const prefetchCache: Map<string, { data?: T; error?: string }> = // @ts-ignore
      (window[PREFETCHED_DATA_EVENT] ??= new Map())

    const existing = prefetchCache.get(id)
    if (existing) {
      const { data, error } = existing
      prefetchCache.delete(id)
      if (error) return reject(error)
      return resolve(data!)
    }

    const onDataEvent = (event: Event) => {
      const { detail } = event as CustomEvent<PrefetchedPromiseEventDetail<T>>
      if (detail.id === id) {
        prefetchCache.delete(id)
        window.removeEventListener(PREFETCHED_DATA_EVENT, onDataEvent)
        const { data, error } = detail
        if (error) return reject(error)
        resolve(data!)
      }
    }

    window.addEventListener(PREFETCHED_DATA_EVENT, onDataEvent)
    signal.addEventListener("abort", () => {
      window.removeEventListener(PREFETCHED_DATA_EVENT, onDataEvent)
      reject()
    })
  })
}

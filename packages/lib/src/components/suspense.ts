import { requestUpdate } from "../scheduler.js"
import { renderMode } from "../globals.js"
import {
  cleanupHook,
  depsRequireChange,
  useHook,
  useId,
} from "../hooks/index.js"
import { __DEV__ } from "../env.js"
import { getCurrentVNode } from "../utils/index.js"
import { HYDRATION_DATA_EVENT } from "../constants.js"
import { Signal, useSignal } from "../signals/index.js"

export type StatefulPromiseValues<
  T extends readonly Kiru.StatefulPromise<unknown>[]
> = {
  [I in keyof T]: T[I] extends Kiru.StatefulPromise<infer V> ? V : never
}

type SuspenseChildrenArgs<
  T extends Kiru.StatefulPromise<any> | Kiru.StatefulPromise<any>[]
> = T extends Kiru.StatefulPromise<any>[]
  ? StatefulPromiseValues<T>
  : [T extends Kiru.StatefulPromise<infer V> ? V : never]

export type SuspenseProps<
  T extends Kiru.StatefulPromise<any> | Kiru.StatefulPromise<any>[]
> = {
  data: T
  children: (...data: SuspenseChildrenArgs<T>) => JSX.Element
  fallback?: JSX.Element
}

interface PromiseResolveEventDetail<T> {
  id: string
  data?: T
  error?: string
}

const promiseCounter = new WeakMap<Kiru.VNode, number>()

function resolveHydrationPromise<T>(
  id: string,
  signal: AbortSignal
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const onDataEvent = (event: Event) => {
      const { detail } = event as CustomEvent<PromiseResolveEventDetail<T>>
      if (detail.id === id) {
        window.removeEventListener(HYDRATION_DATA_EVENT, onDataEvent)
        const { data, error } = detail
        if (error) return reject(error)
        resolve(data!)
      }
    }

    window.addEventListener(HYDRATION_DATA_EVENT, onDataEvent)
    signal.addEventListener("abort", () => {
      window.removeEventListener(HYDRATION_DATA_EVENT, onDataEvent)
      reject()
    })
  })
}

interface UsePromiseContext {
  signal: AbortSignal
}

interface UsePromiseState<T> {
  data: Kiru.StatefulPromise<T>
  refresh: () => void
  pending: Signal<boolean>
}

type UsePromiseHookState<T> = {
  promise: Kiru.StatefulPromise<T>
  abortController?: AbortController
  deps?: unknown[]
}

export function usePromise<T>(
  callback: (ctx: UsePromiseContext) => Promise<T>,
  deps: unknown[]
): UsePromiseState<T> {
  const id = useId()
  const pending = useSignal(true)

  return useHook(
    "usePromise",
    {} as UsePromiseHookState<T>,
    ({ hook, isInit, vNode }) => {
      if (isInit || depsRequireChange(deps, hook.deps)) {
        pending.value = true
        hook.deps = deps
        cleanupHook(hook)

        const controller = (hook.abortController = new AbortController())
        hook.cleanup = () => controller.abort()

        const index = promiseCounter.get(vNode) ?? 0
        promiseCounter.set(vNode, index + 1)

        const promiseId = `${id}:data:${index}`
        const state: Kiru.PromiseState<T> = { id: promiseId, state: "pending" }
        const promise =
          renderMode.current === "hydrate"
            ? resolveHydrationPromise<T>(promiseId, controller.signal)
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

export function Suspense<
  const T extends
    | Kiru.StatefulPromise<unknown>
    | Kiru.StatefulPromise<unknown>[]
>({ data, children, fallback }: SuspenseProps<T>) {
  const promiseArray: Kiru.StatefulPromise<unknown>[] = Array.isArray(data)
    ? data
    : [data]

  switch (renderMode.current) {
    case "stream":
    case "string":
      throw {
        fallback,
        pendingData: promiseArray,
      } satisfies Kiru.RenderInteruptThrowValue

    case "dom":
    case "hydrate":
      for (const p of promiseArray) {
        if (p.state === "rejected") throw p.error
        if (p.state === "pending") {
          const n = getCurrentVNode()!
          Promise.allSettled(promiseArray).then(() => requestUpdate(n))
          return fallback
        }
      }
      const values = promiseArray.map((p) => p.value) as SuspenseChildrenArgs<T>

      return children(...values)
  }
}

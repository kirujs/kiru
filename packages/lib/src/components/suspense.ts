import { requestUpdate } from "../scheduler.js"
import { node, renderMode } from "../globals.js"
import {
  cleanupHook,
  depsRequireChange,
  useHook,
  useId,
  useMemo,
} from "../hooks/index.js"
import { __DEV__ } from "../env.js"

export type StatefulPromiseValues<
  T extends readonly StatefulPromise<unknown>[]
> = {
  [I in keyof T]: T[I] extends StatefulPromise<infer V> ? V : never
}

type SuspenseChildrenArgs<
  T extends StatefulPromise<any> | StatefulPromise<any>[]
> = T extends StatefulPromise<any>[]
  ? StatefulPromiseValues<T>
  : [T extends StatefulPromise<infer V> ? V : never]

export type SuspenseProps<
  T extends StatefulPromise<any> | StatefulPromise<any>[]
> = {
  data: T
  children: (...data: SuspenseChildrenArgs<T>) => JSX.Element
  fallback?: JSX.Element
}

export interface PromiseResolveEventDetail<T> {
  id: string
  idx: number
  data?: T
  error?: unknown
}

function resolveHydrationPromise<T>(
  id: string,
  idx: number,
  signal: AbortSignal
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const onDataEvent = (event: Event) => {
      const { detail } = event as CustomEvent<PromiseResolveEventDetail<T>>
      if (detail.id === id && detail.idx === idx) {
        window.removeEventListener("kiru:hydrationdata", onDataEvent)
        const { data, error } = detail
        if (error) return reject(error)
        resolve(data!)
      }
    }

    window.addEventListener("kiru:hydrationdata", onDataEvent)
    signal.addEventListener("abort", () => {
      window.removeEventListener("kiru:hydrationdata", onDataEvent)
      reject()
    })
  })
}

interface PromiseState<T> {
  state: "pending" | "fulfilled" | "rejected"
  value?: T
  error?: unknown
}

interface StatefulPromise<T> extends Promise<T>, PromiseState<T> {}

interface UsePromiseContext {
  signal: AbortSignal
}

export function usePromise<T>(
  callback: (ctx: UsePromiseContext) => Promise<T>,
  deps: unknown[]
): StatefulPromise<T> {
  const id = useId()

  return useHook(
    "usePromise",
    {
      deps,
      abortController: null as AbortController | null,
      promise: null! as StatefulPromise<T>,
    },
    ({ hook, isInit, index }) => {
      if (isInit || depsRequireChange(deps, hook.deps)) {
        hook.deps = deps
        cleanupHook(hook)

        const controller = (hook.abortController = new AbortController())
        hook.cleanup = () => controller.abort()

        const state: PromiseState<T> = { state: "pending" }
        const promise =
          renderMode.current === "hydrate"
            ? resolveHydrationPromise<T>(id, index, controller.signal)
            : callback({ signal: controller.signal })

        const p = (hook.promise = Object.assign(promise, state))
        p.then((value) => {
          p.state = "fulfilled"
          p.value = value
        }).catch((error) => {
          p.state = "rejected"
          p.error = error
        })
      }
      return hook.promise
    }
  )
}

export interface RenderSuspensionState {
  fallback?: JSX.Element
  data: Promise<unknown>
}

export function Suspense<
  const T extends StatefulPromise<unknown> | StatefulPromise<unknown>[]
>({ data, children, fallback }: SuspenseProps<T>) {
  const promiseArray: StatefulPromise<unknown>[] = Array.isArray(data)
    ? data
    : [data]

  return useMemo(() => {
    const n = node.current!
    switch (renderMode.current) {
      case "stream":
      case "string":
        throw {
          fallback,
          data: Promise.allSettled(promiseArray),
        } satisfies RenderSuspensionState

      case "dom":
      case "hydrate":
        if (promiseArray.some((p) => p.state === "pending")) {
          Promise.allSettled(promiseArray).then(() => requestUpdate(n))
          return fallback
        }

        const rejections = promiseArray.filter((p) => p.state === "rejected")
        if (rejections.length > 0) throw rejections[0].error

        const values = promiseArray.map(
          (p) => p.value
        ) as SuspenseChildrenArgs<T>

        return children(...values)
    }
  }, [...promiseArray, ...promiseArray.map((p) => p.state)])
}

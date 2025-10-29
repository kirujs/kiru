import { $SUSPENSE_THROW } from "../constants.js"
import { __DEV__ } from "../env.js"
import { renderMode, node } from "../globals.js"
import { requestUpdate } from "../scheduler.js"

export { Suspense, isSuspenseThrowValue }
export type { SuspenseProps }

type StatefulPromiseValues<T extends readonly Kiru.StatefulPromise<unknown>[]> =
  {
    [I in keyof T]: T[I] extends Kiru.StatefulPromise<infer V> ? V : never
  }

type SuspenseChildrenArgs<
  T extends Kiru.StatefulPromise<any> | Kiru.StatefulPromise<any>[]
> = T extends Kiru.StatefulPromise<any>[]
  ? StatefulPromiseValues<T>
  : [T extends Kiru.StatefulPromise<infer V> ? V : never]

interface SuspenseProps<
  T extends Kiru.StatefulPromise<any> | Kiru.StatefulPromise<any>[]
> {
  data: T
  children: (...data: SuspenseChildrenArgs<T>) => JSX.Element
  fallback?: JSX.Element
}

function Suspense<
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
        [$SUSPENSE_THROW]: { fallback, pending: promiseArray },
      } satisfies SuspenseThrowValue

    case "dom":
    case "hydrate":
      for (const p of promiseArray) {
        if (p.state === "rejected") throw p.error
        if (p.state === "pending") {
          const n = node.current!
          Promise.allSettled(promiseArray).then(() => requestUpdate(n))
          return fallback
        }
      }
      const values = promiseArray.map((p) => p.value) as SuspenseChildrenArgs<T>

      return children(...values)
  }
}

interface SuspenseThrowValue {
  [$SUSPENSE_THROW]: {
    fallback?: JSX.Element
    pending: Kiru.StatefulPromise<unknown>[]
  }
}

/**
 * Returns true if the value was thrown by a Suspense component.
 */
function isSuspenseThrowValue(value: unknown): value is SuspenseThrowValue {
  return typeof value === "object" && !!value && $SUSPENSE_THROW in value
}

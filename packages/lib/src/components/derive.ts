import type { Signal } from "../signals"
import type { ArrayHas } from "../types.utils"
import { node, renderMode } from "../globals.js"
import { $SUSPENSE_THROW } from "../constants.js"
import { requestUpdate } from "../scheduler.js"
import { useRef } from "../hooks"

type DeriveFromValue =
  | Signal<unknown>
  | Kiru.StatefulPromise<unknown>
  | (Signal<unknown> | Kiru.StatefulPromise<unknown>)[]

type DeriveFromSingleValue<
  T extends Signal<unknown> | Kiru.StatefulPromise<unknown>
> = T extends Signal<infer V>
  ? V
  : T extends Kiru.StatefulPromise<infer P>
  ? P
  : never

type DeriveFromArrayValue<
  T extends readonly (Signal<unknown> | Kiru.StatefulPromise<unknown>)[]
> = {
  [I in keyof T]: DeriveFromSingleValue<T[I]>
}

type DeriveChildrenArgs<T extends DeriveFromValue> = T extends (
  | Signal<unknown>
  | Kiru.StatefulPromise<unknown>
)[]
  ? DeriveFromArrayValue<T>
  : [
      T extends Signal<unknown> | Kiru.StatefulPromise<unknown>
        ? DeriveFromSingleValue<T>
        : never
    ]

type DeriveProps<T extends DeriveFromValue> = {
  from: T
  children: T extends Kiru.StatefulPromise<infer U>
    ? (isStale: boolean, ...values: [U]) => JSX.Children
    : T extends unknown[]
    ? ArrayHas<T, Kiru.StatefulPromise<unknown>> extends true
      ? (isStale: boolean, ...values: DeriveChildrenArgs<T>) => JSX.Children
      : (...values: DeriveChildrenArgs<T>) => JSX.Children
    : (...values: DeriveChildrenArgs<T>) => JSX.Children
  fallback?: T extends Kiru.StatefulPromise<unknown>
    ? JSX.Element
    : T extends unknown[]
    ? ArrayHas<T, Kiru.StatefulPromise<unknown>> extends true
      ? JSX.Element
      : never
    : never
}

export function Derive<const T extends DeriveFromValue>(props: DeriveProps<T>) {
  const { from, children, fallback } = props
  const prevSucessfulPromiseData = useRef<DeriveChildrenArgs<T> | null>(null)

  const items = Array.isArray(from) ? from : [from]
  const values = [] as any as DeriveChildrenArgs<T>
  const promises = new Set<Kiru.StatefulPromise<unknown>>()
  for (const signalOrPromise of items) {
    if (isStatefulPromise(signalOrPromise)) {
      promises.add(signalOrPromise)
    }
    values.push(signalOrPromise.value)
  }

  if (promises.size === 0) {
    return (children as (...values: DeriveChildrenArgs<T>) => JSX.Children)(
      ...values
    )
  }

  switch (renderMode.current) {
    case "stream":
    case "string":
      throw {
        [$SUSPENSE_THROW]: { fallback, pending: Array.from(promises) },
      } satisfies SuspenseThrowValue

    case "dom":
    case "hydrate":
      for (const p of promises) {
        if (p.state === "rejected") throw p.error
        if (p.state === "pending") {
          const n = node.current!
          Promise.allSettled(promises).then(() => requestUpdate(n))
          const prev = prevSucessfulPromiseData.current
          if (prev) {
            return (
              children as (
                isStale: boolean,
                ...values: DeriveChildrenArgs<T>
              ) => JSX.Children
            )(true, ...prev)
          }
          return fallback
        }
      }

      prevSucessfulPromiseData.current = values
      return (
        children as (
          isStale: boolean,
          ...values: DeriveChildrenArgs<T>
        ) => JSX.Children
      )(false, ...values)
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
export function isSuspenseThrowValue(
  value: unknown
): value is SuspenseThrowValue {
  return typeof value === "object" && !!value && $SUSPENSE_THROW in value
}

function isStatefulPromise(
  thing: unknown
): thing is Kiru.StatefulPromise<unknown> {
  return thing instanceof Promise && "id" in thing && "state" in thing
}

import { node } from "../globals.js"
import { $SUSPENSE_THROW } from "../constants.js"
import { requestUpdate } from "../scheduler.js"
import { useRef } from "../hooks/index.js"
import { Signal } from "../signals/index.js"
import { sideEffectsEnabled } from "../utils/index.js"
import type { RecordHas } from "../types.utils"

type DeriveFromValue =
  | Signal<unknown>
  | Kiru.StatefulPromise<unknown>
  | Record<string, Signal<unknown> | Kiru.StatefulPromise<unknown>>

type InnerOf<T> = T extends Signal<infer V>
  ? V
  : T extends Kiru.StatefulPromise<infer P>
  ? P
  : never

type UnwrapDerive<T extends DeriveFromValue> = T extends
  | Signal<any>
  | Kiru.StatefulPromise<any>
  ? InnerOf<T>
  : { [K in keyof T]: InnerOf<T[K]> }

type RecordHasPromise<T extends Record<string, any>> = RecordHas<
  T,
  Kiru.StatefulPromise<any>
>

type ChildFn<T> = (value: T) => JSX.Children
type ChildFnWithStale<T> = (value: T, isStale: boolean) => JSX.Children

type DeriveRenderMode = "swr" | "fallback"

type DeriveProps<
  T extends DeriveFromValue,
  Mode extends DeriveRenderMode = "fallback"
> = {
  from: T
  mode?: Mode
  children: T extends Kiru.StatefulPromise<infer U>
    ? Mode extends "swr"
      ? ChildFnWithStale<U>
      : ChildFn<U>
    : T extends Record<string, any>
    ? RecordHasPromise<T> extends true
      ? Mode extends "swr"
        ? ChildFnWithStale<UnwrapDerive<T>>
        : ChildFn<UnwrapDerive<T>>
      : ChildFn<UnwrapDerive<T>>
    : ChildFn<UnwrapDerive<T>>
  fallback?: T extends Kiru.StatefulPromise<any>
    ? JSX.Element
    : T extends Record<string, any>
    ? RecordHasPromise<T> extends true
      ? JSX.Element
      : never
    : never
}

export function Derive<
  const T extends DeriveFromValue,
  U extends DeriveRenderMode = "swr"
>(props: DeriveProps<T, U>) {
  const { from, children, fallback, mode } = props
  const prevSuccess = useRef<UnwrapDerive<T> | null>(null)

  const promises = new Set<Kiru.StatefulPromise<any>>()
  let value: UnwrapDerive<T>

  if (isStatefulPromise(from)) {
    promises.add(from)
    value = from.value as UnwrapDerive<T>
  } else if (Signal.isSignal(from)) {
    value = from.value as UnwrapDerive<T>
  } else {
    const out: Record<string, any> = {}
    for (const key in from) {
      const v = from[key]
      if (isStatefulPromise(v)) promises.add(v)
      out[key] = (v as Signal<unknown> | Kiru.StatefulPromise<unknown>).value
    }
    value = out as UnwrapDerive<T>
  }

  if (promises.size === 0) {
    return (children as ChildFn<UnwrapDerive<T>>)(value)
  }

  if (!sideEffectsEnabled()) {
    throw {
      [$SUSPENSE_THROW]: {
        fallback,
        pending: Array.from(promises),
      },
    } satisfies SuspenseThrowValue
  }

  for (const p of promises) {
    if (p.state === "rejected") {
      throw p.error
    }
    if (p.state === "pending") {
      const nodeRef = node.current!
      Promise.allSettled(promises).then(() => requestUpdate(nodeRef))

      if (mode !== "fallback" && prevSuccess.current) {
        return (children as ChildFnWithStale<UnwrapDerive<T>>)(
          prevSuccess.current,
          true
        )
      }
      return fallback
    }
  }

  prevSuccess.current = value
  return (children as ChildFnWithStale<UnwrapDerive<T>>)(value, false)
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

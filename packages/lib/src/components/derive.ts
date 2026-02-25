import { node } from "../globals.js"
import { $STREAM_DATA } from "../constants.js"
import { requestUpdate } from "../scheduler.js"
import { Signal } from "../signals/index.js"
import { sideEffectsEnabled } from "../utils/index.js"
import type { RecordHas } from "../types.utils"
import { isStatefulPromise, StreamDataThrowValue } from "../utils/promise.js"
import { ref } from "../ref.js"

export type Derivable =
  | Kiru.Signal<unknown>
  | Kiru.StatefulPromise<unknown>
  | Record<string, Kiru.Signal<unknown> | Kiru.StatefulPromise<unknown>>

type InnerOf<T> = T extends Kiru.Signal<infer V>
  ? V
  : T extends Kiru.StatefulPromise<infer P>
  ? P
  : never

type UnwrapDerive<T extends Derivable> = T extends
  | Kiru.Signal<unknown>
  | Kiru.StatefulPromise<any>
  ? InnerOf<T>
  : { [K in keyof T]: InnerOf<T[K]> }

type RecordHasPromise<T extends Record<string, any>> = RecordHas<
  T,
  Kiru.StatefulPromise<any>
>

type ChildFn<T> = (value: T) => JSX.Children
type ChildFnWithStale<T> = (value: T, isStale: boolean) => JSX.Children

export type DeriveFallbackMode = "swr" | "fallback"

export interface DeriveProps<
  T extends Derivable,
  Mode extends DeriveFallbackMode = "fallback"
> {
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
  T extends Derivable,
  U extends DeriveFallbackMode = "swr"
>(): (props: DeriveProps<T, U>) => JSX.Children {
  return (props) => {
    const { from, children, fallback, mode } = props
    const prevSuccess = ref<UnwrapDerive<T> | null>(null)

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
        [$STREAM_DATA]: {
          fallback,
          data: Array.from(promises),
        },
      } satisfies StreamDataThrowValue
    }
    for (const p of promises) {
      if (p.state === "rejected") {
        throw p.error
      }
      if (p.state === "pending") {
        const nodeRef = node.current!
        Promise.allSettled(promises).then(() => requestUpdate(nodeRef))

        const prev = prevSuccess.current!
        if (mode !== "fallback" && prev) {
          return (children as ChildFnWithStale<UnwrapDerive<T>>)(prev, true)
        }
        return fallback
      }
    }

    prevSuccess.current = value
    return (children as ChildFnWithStale<UnwrapDerive<T>>)(value, false)
  }
}

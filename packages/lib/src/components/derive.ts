import { sideEffectsEnabled } from "../utils/index.js"
import { Signal } from "../signals/index.js"
import { $STREAM_DATA } from "../constants.js"
import { node } from "../globals.js"
import { ref } from "../ref.js"
import { requestUpdate } from "../scheduler.js"
import { isResource, StreamDataThrowValue } from "../resource.js"
import type { RecordHas } from "../types.utils"

export type Derivable =
  | Kiru.Signal<unknown>
  | Kiru.StatefulPromise<unknown>
  | Record<string, Kiru.Signal<unknown> | Kiru.StatefulPromise<unknown>>

type InnerOf<T> =
  T extends Kiru.Signal<infer V>
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
  Mode extends DeriveFallbackMode = "fallback",
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

type Derive = {
  <T extends Derivable, U extends DeriveFallbackMode = "swr">(
    props: DeriveProps<T, U>
  ): (props: DeriveProps<T, U>) => JSX.Element
}

/**
 * Derives a value from a signal or stateful promise and renders a child component.
 * @see https://kirujs.dev/docs/components/derive
 */
export const Derive: Derive = () => {
  const prevSuccess = ref<unknown>(null)
  return (props) => {
    const { from, children, fallback, mode } = props

    const promises = new Set<Kiru.StatefulPromise<any>>()
    let value: unknown

    if (isResource(from)) {
      promises.add(from.promise)
      value = from.value as unknown
    } else if (Signal.isSignal(from)) {
      value = from.value as unknown
    } else {
      const out: Record<string, any> = {}
      for (const key in from) {
        const v = from[key]
        if (isResource(v)) promises.add(v.promise)
        out[key] = (v as Signal<unknown> | Kiru.StatefulPromise<unknown>).value
      }
      value = out as unknown
    }

    if (promises.size === 0) {
      return (children as ChildFn<unknown>)(value)
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
          return (children as ChildFnWithStale<unknown>)(prev, true)
        }
        return fallback
      }
    }

    prevSuccess.current = value
    return (children as ChildFnWithStale<unknown>)(value, false)
  }
}

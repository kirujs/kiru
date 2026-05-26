import {
  sideEffectsEnabled,
  type StreamDataThrowValue,
} from "../utils/index.js"
import { isSignal, type Signal } from "../signals/index.js"
import { $STREAM_DATA } from "../constants.js"
import { node } from "../globals.js"
import { requestUpdate } from "../scheduler.js"
import { isResource, Resource } from "../resource.js"
import type { RecordHas } from "../types.utils.js"

export type Derivable =
  | Kiru.Signal<any>
  | Resource<any>
  | Record<string, Kiru.Signal<any> | Resource<any>>

type InnerOf<T> = T extends Kiru.Signal<infer V> ? V : never

type UnwrapDerivable<T extends Derivable> = T extends Kiru.Signal<any>
  ? InnerOf<T>
  : T extends Resource<any>
  ? InnerOf<T>
  : { [K in keyof T]: InnerOf<T[K & keyof T]> }

type RecordHasResource<T extends Record<string, any>> = RecordHas<
  T,
  Resource<any>
>

type ChildFn<T> = (value: T) => JSX.Element
type ChildFnWithStale<T> = (value: T, isStale: boolean) => JSX.Element

export type DeriveFallbackMode = "swr" | "fallback"

export interface DeriveProps<
  T extends Derivable,
  Mode extends DeriveFallbackMode = "fallback"
> {
  from: T
  mode?: Mode
  children: T extends Resource<infer U>
    ? Mode extends "swr"
      ? ChildFnWithStale<U>
      : ChildFn<U>
    : T extends Record<string, any>
    ? RecordHasResource<T> extends true
      ? Mode extends "swr"
        ? ChildFnWithStale<UnwrapDerivable<T>>
        : ChildFn<UnwrapDerivable<T>>
      : ChildFn<UnwrapDerivable<T>>
    : ChildFn<UnwrapDerivable<T>>
  fallback?: T extends Resource<any>
    ? JSX.Element
    : T extends Record<string, any>
    ? RecordHasResource<T> extends true
      ? JSX.Element
      : never
    : never
}

function readDerivableValue(from: Derivable): unknown {
  if (isSignal(from)) {
    return from() as unknown
  }
  const out: Record<string, unknown> = {}
  for (const key in from) {
    const v = from[key]
    out[key] = isSignal(v)
      ? (v as Signal<unknown>)()
      : (v as Kiru.StatefulPromise<unknown>).value
  }
  return out
}

/** JSX-facing generic; runtime is setup-style `() => (props) => …`. */
export type DeriveComponent = {
  <T extends Derivable, Mode extends DeriveFallbackMode = "fallback">(
    props: DeriveProps<T, Mode>
  ): (props: DeriveProps<T, Mode>) => JSX.Element
}

/**
 * Derives a value from a signal or stateful promise and renders a child component.
 * @see https://kirujs.dev/docs/components/derive
 */
export const Derive = (() => {
  let prevSuccess: { value: unknown } | null
  return ({
    from,
    children,
    fallback,
    mode,
  }: DeriveProps<Derivable, DeriveFallbackMode>) => {
    const promises = new Set<Kiru.StatefulPromise<any>>()
    const value = readDerivableValue(from)

    if (isResource(from)) {
      promises.add(from.promise)
    } else if (!isSignal(from)) {
      for (const key in from) {
        const v = from[key]
        if (isResource(v)) promises.add(v.promise)
      }
    }

    if (promises.size === 0) {
      return (children as ChildFn<unknown>)(value)
    }

    for (const p of promises) {
      if (p.state === "rejected") {
        throw p.error
      }
    }

    const pending = [...promises].filter((p) => p.state === "pending")

    if (!sideEffectsEnabled()) {
      if (pending.length === 0) {
        return (children as ChildFnWithStale<unknown>)(value, false)
      }
      throw {
        [$STREAM_DATA]: {
          fallback,
          data: pending,
          continue: () =>
            (children as ChildFnWithStale<unknown>)(
              readDerivableValue(from),
              false
            ),
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

        if (mode !== "fallback" && prevSuccess) {
          return (children as ChildFnWithStale<unknown>)(
            prevSuccess.value,
            true
          )
        }
        return fallback
      }
    }

    prevSuccess = { value }
    return (children as ChildFnWithStale<unknown>)(value, false)
  }
}) as DeriveComponent

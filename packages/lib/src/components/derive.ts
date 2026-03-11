import {
  sideEffectsEnabled,
  type StreamDataThrowValue,
} from "../utils/index.js"
import { Signal } from "../signals/index.js"
import { $STREAM_DATA } from "../constants.js"
import { node } from "../globals.js"
import { requestUpdate } from "../scheduler.js"
import { isResource, Resource } from "../resource.js"
import type { RecordHas } from "../types.utils"

export type Derivable =
  | Kiru.Signal<unknown>
  | Record<string, Kiru.Signal<unknown>>

type InnerOf<T> = T extends Kiru.Signal<infer V> ? V : never

type UnwrapDerivable<T extends Derivable> =
  T extends Kiru.Signal<unknown>
    ? InnerOf<T>
    : { [K in keyof T]: InnerOf<T[K]> }

type RecordHasResource<T extends Record<string, any>> = RecordHas<
  T,
  Resource<any>
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
  let prevSuccess: unknown
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

        const prev = prevSuccess
        if (mode !== "fallback" && prev) {
          return (children as ChildFnWithStale<unknown>)(prev, true)
        }
        return fallback
      }
    }

    prevSuccess = value
    return (children as ChildFnWithStale<unknown>)(value, false)
  }
}

import { Signalable } from "../types.js"
import type { Signal } from "./base.js"
import { unwrap } from "./utils.js"

type InferArraySignalItemType<T extends Signal<any[]> | readonly unknown[]> =
  T extends Signal<infer V>
    ? V extends Array<infer W>
      ? W
      : never
    : T extends unknown[]
      ? T[number]
      : never

type ForProps<
  T extends Signal<any[]> | readonly unknown[],
  U = InferArraySignalItemType<T>,
> = {
  each: T
  fallback?: JSX.Element
  children: (value: U, index: number, array: U[]) => JSX.Element
}

export function For<T extends Signal<any[]> | unknown[]>({
  each,
  fallback,
  children,
}: ForProps<T>) {
  const items = unwrap(each, true)
  if (items.length === 0) return fallback
  return items.map(children)
}

export interface ShowProps {
  children: JSX.Element
  when: Signalable<unknown>
  fallback?: JSX.Element
}
export function Show({ children, when, fallback }: ShowProps): JSX.Element {
  return !!unwrap(when, true) ? children : fallback
}

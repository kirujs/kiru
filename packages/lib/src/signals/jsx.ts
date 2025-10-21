import type { Signal } from "./base.js"
import type { SignalValues } from "./types.js"

type InferArraySignalItemType<T extends Signal<any[]>> = T extends Signal<
  infer V
>
  ? V extends Array<infer W>
    ? W
    : never
  : never

type ForProps<T extends Signal<any[]>, U = InferArraySignalItemType<T>> = {
  each: T
  fallback?: JSX.Element
  children: (value: U, index: number, array: U[]) => JSX.Element
}

export function For<T extends Signal<any[]>>({
  each,
  fallback,
  children,
}: ForProps<T>) {
  const items = each.value
  if (items.length === 0) return fallback
  return items.map(children)
}

type DeriveChildrenArgs<T extends Signal<any> | Signal<any>[]> =
  T extends Signal<any>[]
    ? SignalValues<T>
    : [T extends Signal<infer V> ? V : never]

export type DeriveProps<T extends Signal<any> | Signal<any>[]> = {
  from: T
  children: (...values: DeriveChildrenArgs<T>) => JSX.Children
}

export function Derive<const T extends Signal<any> | Signal<any>[]>({
  from,
  children,
}: DeriveProps<T>) {
  const args = (Array.isArray(from) ? from : [from]).map(
    (s) => s.value
  ) as DeriveChildrenArgs<T>
  return children(...args)
}

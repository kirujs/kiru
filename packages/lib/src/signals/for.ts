import type { Signal } from "./base.js"

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

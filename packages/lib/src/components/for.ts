import { unwrap, type Signal } from "../signals/index.js"

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
  U = InferArraySignalItemType<T>
> = {
  each: T
  fallback?: JSX.Element
  children: (value: U, index: number, array: U[]) => JSX.Element
}

/**
 * Renders a list of items. If the list a Signal, it creates an automatically-updating list with fine-grained reactivity.
 * If the list is empty, the fallback is rendered.
 * @see https://kirujs.dev/docs/api/components/for
 */
export function For<T extends Signal<any[]> | unknown[]>({
  each,
  fallback,
  children,
}: ForProps<T>) {
  const items = unwrap(each, true)
  if (items.length === 0) return fallback
  return items.map(children)
}

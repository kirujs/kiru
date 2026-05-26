import { unwrap, type Signal as SignalType } from "../signals/index.js"

type ForEachInput = SignalType<readonly any[]> | readonly any[]

type InferArraySignalItemType<T extends ForEachInput> =
  T extends SignalType<infer V extends readonly any[]>
    ? V[number]
    : T extends readonly any[]
      ? T[number]
      : never

type ForProps<
  T extends ForEachInput,
  U = InferArraySignalItemType<T>,
> = {
  each: T
  fallback?: JSX.Element
  children: (value: U, index: number, array: readonly U[]) => JSX.Element
}

/**
 * Renders a list of items. If the list a Signal, it creates an automatically-updating list with fine-grained reactivity.
 * If the list is empty, the fallback is rendered.
 * @see https://kirujs.dev/docs/components/for
 */
export function For<T extends ForEachInput>({
  each,
  fallback,
  children,
}: ForProps<T>) {
  const items = unwrap(each, true)
  if (items.length === 0) return fallback
  return items.map(children)
}

import { unwrap } from "../signals/index.js"
import type { Truthy } from "../types.utils.js"
import type { Signalable } from "../types.js"

type ShowChildren<T> = (value: Truthy<T>) => JSX.Element

export interface ShowProps<T> {
  children: ShowChildren<T> | Exclude<JSX.Element, ShowChildren<T>>
  when: Signalable<T>
  fallback?: JSX.Element
}

/**
 * Conditionally renders a child component based on the 'when' prop.
 * If the 'when' prop is truthy, the child component is rendered.
 * If the 'when' prop is falsy, the fallback component is rendered.
 * If the 'when' prop is a Signal, it creates an automatically-updating component with fine-grained reactivity.
 * @see https://kirujs.dev/docs/api/components/show
 */
export function Show<T>({
  children,
  when,
  fallback,
}: ShowProps<T>): JSX.Element {
  const value = unwrap(when, true)
  if (!!value) {
    return typeof children === "function"
      ? children(value as Truthy<T>)
      : children
  }
  return fallback
}

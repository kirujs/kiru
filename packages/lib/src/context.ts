import { $CONTEXT } from "./constants.js"
import { createElement } from "./element.js"
import type { ContextNode } from "./types.utils.js"
import { node } from "./globals.js"

export function createContext<T>(defaultValue: T): Kiru.Context<T> {
  const Context: Kiru.Context<T> = Object.assign(
    ({ value, children }: Kiru.ContextProps<T>) =>
      createElement($CONTEXT, { value, ctx: Context }, children),
    { [$CONTEXT]: () => defaultValue }
  )
  Context.displayName = "Anonymous Context"
  return Context
}

function getContextValue<T>(vNode: Kiru.VNode, context: Kiru.Context<T>): T {
  let n = vNode.parent
  while (n) {
    if (n.type === $CONTEXT) {
      const provider = n as ContextNode<unknown>
      const { ctx, value } = provider.props
      if (ctx === context) {
        return value as T
      }
    }
    n = n.parent
  }
  return context[$CONTEXT]()
}

export function useContext<T>(context: Kiru.Context<T>): T {
  const n = node.current
  if (!n) {
    throw new Error("useContext must be called inside a Kiru component")
  }
  return getContextValue(n, context)
}

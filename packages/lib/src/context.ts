import { noop } from "./utils/index.js"
import { $CONTEXT, $CONTEXT_PROVIDER } from "./constants.js"
import { createElement } from "./element.js"
import { ref } from "./ref.js"
import type { ContextProviderNode } from "./types.utils.js"

export function createContext<T>(defaultValue: T): Kiru.Context<T> {
  const ctx: Kiru.Context<T> = {
    [$CONTEXT]: true,
    Provider: ({ value, children }: Kiru.ProviderProps<T>) => {
      const dependents = ref(new Set<Kiru.VNode>())
      return () =>
        createElement(
          $CONTEXT_PROVIDER,
          { value, ctx, dependents },
          typeof children === "function" ? children(value) : children
        )
    },
    default: () => defaultValue,
    set displayName(name: string) {
      this.Provider.displayName = name
    },
    get displayName() {
      return this.Provider.displayName || "Anonymous Context"
    },
  }

  return ctx
}

export function isContext<T>(thing: unknown): thing is Kiru.Context<T> {
  return typeof thing === "object" && !!thing && $CONTEXT in thing
}

export function getContext<T>(
  vNode: Kiru.VNode,
  context: Kiru.Context<T>
): { value: T; cleanup: () => void } {
  let n = vNode.parent
  while (n) {
    if (n.type === $CONTEXT_PROVIDER) {
      const provider = n as ContextProviderNode<T>
      const { ctx, value, dependents } = provider.props
      if (ctx === context) {
        dependents.add(vNode)
        return { value, cleanup: () => dependents.delete(vNode) }
      }
    }
    n = n.parent
  }
  return { value: context.default(), cleanup: noop }
}

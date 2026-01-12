import { $CONTEXT, $CONTEXT_PROVIDER } from "./constants.js"
import { createElement } from "./element.js"
import { useState } from "./hooks/useState.js"

export function createContext<T>(defaultValue: T): Kiru.Context<T> {
  const ctx: Kiru.Context<T> = {
    [$CONTEXT]: true,
    Provider: ({ value, children }: Kiru.ProviderProps<T>) => {
      const [dependents] = useState(() => new Set<Kiru.VNode>())
      return createElement(
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

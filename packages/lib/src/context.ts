import { $CONTEXT, $CONTEXT_PROVIDER, $HMR_ACCEPT } from "./constants.js"
import { createElement } from "./element.js"
import { __DEV__ } from "./env.js"
import { GenericHMRAcceptor } from "./hmr.js"
import { useState } from "./hooks/useState.js"
import { requestUpdate } from "./scheduler.js"
import { traverseApply } from "./utils/index.js"

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
  if (__DEV__) {
    const asHmrAcceptor = ctx as any as GenericHMRAcceptor<Kiru.Context<T>>
    asHmrAcceptor[$HMR_ACCEPT] = {
      inject: (prev) => {
        const newProvider = ctx.Provider
        window.__kiru!.apps.forEach((ctx) => {
          traverseApply(ctx.rootNode, (vNode) => {
            if (vNode.type === prev.Provider) {
              vNode.type = newProvider
              vNode.hmrUpdated = true
              requestUpdate(vNode)
            }
          })
        })
      },
      destroy: () => {},
      provide: () => ctx,
    }
  }

  return ctx
}

export function isContext<T>(thing: unknown): thing is Kiru.Context<T> {
  return typeof thing === "object" && !!thing && $CONTEXT in thing
}

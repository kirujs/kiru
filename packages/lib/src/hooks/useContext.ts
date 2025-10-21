import type { ContextProviderNode } from "../types.utils.js"
import { type HookCallbackState, useHook } from "./utils.js"
import { __DEV__ } from "../env.js"
import { $CONTEXT_PROVIDER } from "../constants.js"

type UseContextHookState<T> = {
  provider?: ContextProviderNode<T>
  context: Kiru.Context<T>
  warnIfNotFound: boolean
}

/**
 * Gets the current value of a context provider created by the context.
 *
 * @see https://kirujs.dev/docs/hooks/useContext
 */
export function useContext<T>(
  context: Kiru.Context<T>,
  warnIfNotFound = true
): T {
  return useHook(
    "useContext",
    {
      context,
      warnIfNotFound,
    } satisfies UseContextHookState<T>,
    useContextCallback as typeof useContextCallback<T>
  )
}

const useContextCallback = <T>({
  hook,
  isInit,
  vNode,
}: HookCallbackState<UseContextHookState<T>>) => {
  if (__DEV__) {
    hook.dev = {
      devtools: {
        get: () => ({
          contextName: hook.context.Provider.displayName || "",
          value: hook.provider
            ? hook.provider.props.value
            : hook.context.default(),
        }),
      },
    }
  }
  if (isInit) {
    let n = vNode.parent
    while (n) {
      if (n.type === $CONTEXT_PROVIDER) {
        const provider = n as ContextProviderNode<T>
        const { ctx, value, dependents } = provider.props
        if (ctx === hook.context) {
          dependents.add(vNode)
          hook.cleanup = () => dependents.delete(vNode)
          hook.provider = provider
          return value
        }
      }
      n = n.parent
    }
  }
  if (!hook.provider) {
    if (__DEV__) {
      hook.warnIfNotFound && warnProviderNotFound(hook.context)
    }
    return hook.context.default()
  }
  return hook.provider.props.value
}

const contextsNotFound = new Set<Kiru.Context<any>>()
function warnProviderNotFound(ctx: Kiru.Context<any>) {
  if (!contextsNotFound.has(ctx)) {
    contextsNotFound.add(ctx)
    console.warn("[kiru]: Unable to find context provider")
  }
}

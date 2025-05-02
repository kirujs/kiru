import type { ContextProviderNode } from "../types.utils.js"
import { type HookCallbackState, useHook } from "./utils.js"
import { __DEV__ } from "../env.js"
import { $CONTEXT_PROVIDER } from "../constants.js"

type UseContextHookState<T> = {
  ctxNode: ContextProviderNode<T> | undefined
  context: Kaioken.Context<T>
  warnIfNotFound: boolean
}

/**
 * Gets the current value of a context provider created by the context.
 *
 * @see https://kaioken.dev/docs/hooks/useContext
 */
export function useContext<T>(
  context: Kaioken.Context<T>,
  warnIfNotFound = true
): T {
  return useHook(
    "useContext",
    { ctxNode: undefined, context, warnIfNotFound },
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
          value: hook.ctxNode
            ? hook.ctxNode.props.value
            : hook.context.default(),
        }),
      },
    }
  }
  if (isInit) {
    let n = vNode.parent
    while (n) {
      if (n.type === $CONTEXT_PROVIDER) {
        const ctxNode = n as ContextProviderNode<T>
        if (ctxNode.props.ctx === hook.context) {
          hook.ctxNode = ctxNode
          return hook.ctxNode.props.value
        }
      }
      n = n.parent
    }
  }
  if (!hook.ctxNode) {
    if (__DEV__) {
      hook.warnIfNotFound && warnProviderNotFound(hook.context)
    }
    return hook.context.default()
  }
  return hook.ctxNode.props.value
}

const contextsNotFound = new Set<Kaioken.Context<any>>()
function warnProviderNotFound(ctx: Kaioken.Context<any>) {
  if (!contextsNotFound.has(ctx)) {
    contextsNotFound.add(ctx)
    console.warn("[kaioken]: Unable to find context provider")
  }
}

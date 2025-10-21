import { __DEV__ } from "../env.js"
import { sideEffectsEnabled } from "../utils/index.js"
import { depsRequireChange, useHook } from "./utils.js"

/**
 * Creates a memoized callback function.
 *
 * @see https://kirujs.dev/docs/hooks/useCallback
 */
export function useCallback<T extends Function>(
  callback: T,
  deps: unknown[]
): T {
  if (!sideEffectsEnabled()) return callback
  return useHook("useCallback", { callback, deps }, ({ hook, isHMR }) => {
    if (__DEV__) {
      hook.dev = {
        devtools: {
          get: () => ({ callback: hook.callback, dependencies: hook.deps }),
        },
      }
      if (isHMR) {
        hook.deps = []
      }
    }
    if (depsRequireChange(deps, hook.deps)) {
      hook.deps = deps
      hook.callback = callback
    }
    return hook.callback
  })
}

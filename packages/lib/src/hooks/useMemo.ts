import { sideEffectsEnabled } from "../utils/index.js"
import { __DEV__ } from "../env.js"
import { depsRequireChange, useHook } from "./utils.js"

/**
 * Creates a memoized value that only changes when the [dependency
 * array](https://kirujs.dev/docs/hooks/dependency-arrays) has changed.
 *
 * @see https://kirujs.dev/docs/hooks/useMemo
 */
export function useMemo<T>(factory: () => T, deps: unknown[]): T {
  if (!sideEffectsEnabled()) return factory()
  return useHook(
    "useMemo",
    { deps, value: undefined as T },
    ({ hook, isInit, isHMR }) => {
      if (__DEV__) {
        hook.dev = {
          devtools: {
            get: () => ({ value: hook.value, dependencies: hook.deps }),
          },
        }
        if (isHMR) {
          isInit = true
        }
      }
      if (isInit || depsRequireChange(deps, hook.deps)) {
        hook.deps = deps
        hook.value = factory()
      }
      return hook.value
    }
  )
}

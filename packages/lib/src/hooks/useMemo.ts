import { __DEV__ } from "../env.js"
import { depsRequireChange, sideEffectsEnabled, useHook } from "./utils.js"

/**
 * Creates a memoized value that only changes when the [dependency
 * array](https://kaioken.dev/docs/hooks/dependency-arrays) has changed.
 *
 * @see https://kaioken.dev/docs/hooks/useMemo
 */
export function useMemo<T>(factory: () => T, deps: unknown[]): T {
  if (!sideEffectsEnabled()) return factory()
  return useHook(
    "useMemo",
    { deps, value: undefined as T },
    ({ hook, isInit }) => {
      if (__DEV__) {
        hook.dev = {
          devtools: {
            get: () => ({ value: hook.value, dependencies: hook.deps }),
          },
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

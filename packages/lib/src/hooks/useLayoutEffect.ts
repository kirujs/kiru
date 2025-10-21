import { sideEffectsEnabled } from "../utils/index.js"
import { __DEV__ } from "../env.js"
import { cleanupHook, depsRequireChange, useHook } from "./utils.js"

/**
 * Runs a function before the component is rendered, or when a value provided in the optional [dependency
 * array](https://kirujs.dev/docs/hooks/dependency-arrays) has changed.
 *
 * @see https://kirujs.dev/docs/hooks/useLayoutEffect
 * */
export function useLayoutEffect(
  callback: () => void | (() => void),
  deps?: unknown[]
): void {
  if (!sideEffectsEnabled()) return
  return useHook(
    "useLayoutEffect",
    { deps },
    ({ hook, isInit, isHMR, queueEffect }) => {
      if (__DEV__) {
        hook.dev = {
          devtools: { get: () => ({ callback, dependencies: hook.deps }) },
        }
        if (isHMR) {
          isInit = true
        }
      }
      if (isInit || depsRequireChange(deps, hook.deps)) {
        hook.deps = deps
        cleanupHook(hook)
        queueEffect(
          () => {
            const cleanup = callback()
            if (typeof cleanup === "function") {
              hook.cleanup = cleanup
            }
          },
          { immediate: true }
        )
      }
    }
  )
}

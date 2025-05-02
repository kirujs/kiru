import { __DEV__ } from "../env.js"
import {
  cleanupHook,
  depsRequireChange,
  sideEffectsEnabled,
  useHook,
} from "./utils.js"

/**
 * Runs a function after the component is rendered, or when a value provided in the optional [dependency
 * array](https://kaioken.dev/docs/hooks/dependency-arrays) has changed.
 *
 * @see https://kaioken.dev/docs/hooks/useEffect
 * */
export function useEffect(
  callback: () => void | (() => void),
  deps?: unknown[]
): void {
  if (!sideEffectsEnabled()) return
  return useHook("useEffect", { deps }, ({ hook, isInit, queueEffect }) => {
    if (__DEV__) {
      hook.dev = {
        devtools: { get: () => ({ callback, dependencies: hook.deps }) },
      }
    }
    if (isInit || depsRequireChange(deps, hook.deps)) {
      hook.deps = deps
      cleanupHook(hook)
      queueEffect(() => {
        const cleanup = callback()
        if (typeof cleanup === "function") {
          hook.cleanup = cleanup
        }
      })
    }
  })
}

import { node } from "../globals.js"
import { __DEV__ } from "../env.js"
import { sideEffectsEnabled, useHook } from "./utils.js"

/**
 * Wraps a function to be called within effects and other callbacks.
 * The function will be called with the same arguments as the original function.
 *
 * @see https://kaioken.dev/docs/hooks/useEffectEvent
 */
export function useEffectEvent<T extends Function>(callback: T): T {
  if (!sideEffectsEnabled()) return callback
  return useHook("useEffectEvent", { callback }, ({ hook }) => {
    if (__DEV__) {
      hook.dev = {
        // persist function ref so that effects referring to it will continue using the latest version
        reinitUponRawArgsChanged: true,
      }
    }
    hook.callback = callback
    return function () {
      if (node.current) {
        throw new Error(
          "A function wrapped in useEffectEvent can't be called during rendering."
        )
      }
      return hook.callback.apply(void 0, arguments)
    } as any as T
  })
}

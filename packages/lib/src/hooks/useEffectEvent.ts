import { sideEffectsEnabled } from "../utils/index.js"
import { node } from "../globals.js"
import { useHook } from "./utils.js"

/**
 * Wraps a function to be called within effects and other callbacks.
 * The function will be called with the same arguments as the original function.
 *
 * @see https://kirujs.dev/docs/hooks/useEffectEvent
 */
export function useEffectEvent<T extends Function>(callback: T): T {
  if (!sideEffectsEnabled()) return callback
  return useHook("useEffectEvent", { callback }, ({ hook }) => {
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

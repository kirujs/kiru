import { flushSync } from "../scheduler.js"
import { node } from "../globals.js"
import { noop, sideEffectsEnabled } from "../utils/index.js"

/**
 * Allows you to easily use the [View Transition API](https://developer.mozilla.org/en-US/docs/Web/API/Document/startViewTransition)
 * by wrapping the `callback` in a `document.startViewTransition` call.
 *
 * Falls back to the regular `callback` if not supported.
 *
 * @see https://kirujs.dev/docs/hooks/useViewTransition
 */
export function useViewTransition() {
  if (!sideEffectsEnabled()) return noop
  return (callback: () => void) => {
    if (node.current) {
      throw new Error("useViewTransition can't be called during rendering.")
    }
    if (!document.startViewTransition) return callback()
    document.startViewTransition(() => {
      callback()
      flushSync()
    })
  }
}

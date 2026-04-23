import { node } from "../globals.js"
import { generateRandomID, sideEffectsEnabled } from "../utils/index.js"

/**
 * Registers a cleanup function that runs when the component unmounts.
 * Intended for use during component setup when the component returns a render function.
 *
 * @see https://kirujs.dev/docs/api/lifecycles#onCleanup
 */
export function onCleanup(fn: () => void): void {
  if (!sideEffectsEnabled()) return
  const current = node.current
  if (!current || typeof current.type !== "function") {
    throw new Error("Cannot queue onCleanup effect outside of a component")
  }
  ;(current.cleanups ??= {})[generateRandomID(10)] = fn
}

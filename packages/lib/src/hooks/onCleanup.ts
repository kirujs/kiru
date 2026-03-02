import { node } from "../globals.js"
import {
  generateRandomID,
  registerVNodeCleanup,
  sideEffectsEnabled,
} from "../utils/index.js"

/**
 * Registers a cleanup function that runs when the component unmounts.
 * Intended for use during component setup when the component returns a render function.
 *
 * @see https://kirujs.dev/docs/api/lifecycles#onCleanup
 */
export function onCleanup(fn: () => void): void {
  if (!sideEffectsEnabled()) return
  const vNode = node.current!
  if (!vNode) {
    throw new Error("Cannot queue onCleanup effect outside of a component")
  }
  registerVNodeCleanup(vNode, generateRandomID(10), fn)
}

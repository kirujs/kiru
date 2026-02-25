import { node } from "../globals.js"
import { generateRandomID, registerVNodeCleanup } from "../utils/index.js"

/**
 * Registers a cleanup function that runs when the component unmounts.
 * Intended for use during component setup when the component returns a render function.
 *
 * @see https://kirujs.dev/docs/hooks/onCleanup
 */
export function onCleanup(fn: () => void): void {
  const vNode = node.current!
  if (!vNode)
    throw new Error("Cannot queue cleanup effect outside of a component")
  registerVNodeCleanup(vNode, generateRandomID(10), fn)
}

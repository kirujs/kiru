import { sideEffectsEnabled } from "../utils/index.js"
import { getVNodeLifecycleHooks, wrapLifecycleHookCallback } from "./utils.js"

/**
 * Registers a callback that runs after the component is first mounted to the DOM.
 * Optionally returns a cleanup function that will run after the component unmounts.
 * Intended for use during component setup when the component returns a render function.
 *
 * @see https://kirujs.dev/docs/api/lifecycles#onMount
 */
export function onMount(fn: () => (() => void) | void): void {
  if (!sideEffectsEnabled()) return
  const hooks = getVNodeLifecycleHooks()
  if (!hooks) {
    throw new Error("Cannot queue onMount effect outside of a component")
  }
  hooks.post.push(wrapLifecycleHookCallback(fn, hooks.postCleanups))
}

import { Setup } from "./hooks/index.js"
import { isBrowser } from "./env.js"
export { node, renderMode, hydrationMode, setups, postEffectCleanups }

/**
 * A reference to the current VNode (always a component) being rendered.
 */
const node = {
  current: null as Kiru.VNode | null,
}

/**
 * The current render mode. Can be "dom" "string", "stream", or "hydrate".
 */
const renderMode = {
  current: (isBrowser ? "dom" : "string") as Kiru.RenderMode,
}

/**
 * The current hydration mode. Can be "static" or "dynamic".
 * Used to indicate whether the page being hydrated will contain streamed content.
 */
const hydrationMode = {
  current: "dynamic" as "static" | "dynamic",
}

/**
 * A map of VNodes (components) to their setup functions.
 */
const setups: WeakMap<Kiru.VNode, Setup<any>> = new WeakMap()

/**
 * Cleanup functions from onMount() that run after components
 * have been unmounted and the browser has painted.
 */
const postEffectCleanups: (() => void)[] = []

import type { Setup } from "./hooks/setup.js"
import { isBrowser } from "./env.js"
export { node, renderMode, hydrationMode, setups, postEffectCleanups }

/**
 * A reference to the current owner node being rendered.
 */
const node = {
  current: null as Kiru.KiruNode | null,
}

const owner = node

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
 * A map of owner nodes (components) to their setup functions.
 */
const setups: WeakMap<object, Setup<{}>> = new WeakMap()

/**
 * Cleanup functions from onMount() that run after components
 * have been unmounted and the browser has painted.
 */
const postEffectCleanups: (() => void)[] = []

export { owner }

import { Setup } from "./hooks/index.js"
export { node, renderMode, hydrationMode, setups }
import { isBrowser } from "./env.js"

const node = {
  current: null as Kiru.VNode | null,
}

const renderMode = {
  current: (isBrowser ? "dom" : "string") as Kiru.RenderMode,
}

const hydrationMode = {
  current: "dynamic" as "static" | "dynamic",
}

const setups: WeakMap<Kiru.VNode, Setup<any>> = new WeakMap()

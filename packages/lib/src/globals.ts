import { Setup } from "./hooks/index.js"
export { node, renderMode, hydrationMode, setups }

const node = {
  current: null as Kiru.VNode | null,
}

const renderMode = {
  current: ("window" in globalThis ? "dom" : "string") as Kiru.RenderMode,
}

const hydrationMode = {
  current: "dynamic" as "static" | "dynamic",
}

const setups: WeakMap<Kiru.VNode, Setup<any>> = new WeakMap()

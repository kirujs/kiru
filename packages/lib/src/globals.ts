export { node, hookIndex, renderMode, hydrationMode }

const node = {
  current: null as Kiru.VNode | null,
}

const hookIndex = {
  current: 0,
}

const renderMode = {
  current: ("window" in globalThis ? "dom" : "string") as Kiru.RenderMode,
}

const hydrationMode = {
  current: "dynamic" as "static" | "dynamic",
}

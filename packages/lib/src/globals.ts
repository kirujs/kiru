export { node, hookIndex, renderMode }

const node = {
  current: null as Kiru.VNode | null,
}

const hookIndex = {
  current: 0,
}

const renderMode = {
  current: ("window" in globalThis ? "dom" : "string") as Kiru.RenderMode,
}

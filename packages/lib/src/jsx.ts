import { createElement, Fragment } from "./element.js"

export { jsx, jsx as jsxs, jsx as jsxDEV, Fragment }

function jsx(
  type: Kiru.KiruNode["type"],
  { children, ...props } = {} as { children?: Kiru.KiruNode[] }
) {
  if (!children) return createElement(type, props)
  return createElement(type, props, children)
}

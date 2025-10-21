import { createElement, Fragment } from "./element.js"

export { jsx, jsx as jsxs, jsx as jsxDEV, Fragment }

function jsx(
  type: Kiru.VNode["type"],
  { children, ...props } = {} as { children?: Kiru.VNode[] }
) {
  if (!children) return createElement(type, props)
  return createElement(type, props, children)
}

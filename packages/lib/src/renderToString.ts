import { node, renderMode } from "./globals.js"
import { Fragment } from "./element.js"
import {
  isVNode,
  encodeHtmlEntities,
  propsToElementAttributes,
  isExoticType,
  assertValidElementProps,
} from "./utils/index.js"
import { Signal } from "./signals/base.js"
import { $HYDRATION_BOUNDARY, voidElements } from "./constants.js"
import { HYDRATION_BOUNDARY_MARKER } from "./ssr/hydrationBoundary.js"
import { __DEV__ } from "./env.js"

export function renderToString(element: JSX.Element) {
  const prev = renderMode.current
  renderMode.current = "string"
  const rootNode = Fragment({ children: element })
  const res = renderToString_internal(rootNode, null, 0)
  renderMode.current = prev
  return res
}

function renderToString_internal(
  el: unknown,
  parent: Kiru.VNode | null,
  idx: number
): string {
  if (el === null) return ""
  if (el === undefined) return ""
  if (typeof el === "boolean") return ""
  if (typeof el === "string") return encodeHtmlEntities(el)
  if (typeof el === "number" || typeof el === "bigint") return el.toString()
  if (el instanceof Array) {
    return el.map((c, i) => renderToString_internal(c, parent, i)).join("")
  }
  if (Signal.isSignal(el)) return String(el.peek())
  if (!isVNode(el)) return String(el)
  el.parent = parent
  el.depth = (parent?.depth ?? -1) + 1
  el.index = idx
  const { type, props = {} } = el
  if (type === "#text") return encodeHtmlEntities(props.nodeValue ?? "")

  const children = props.children
  if (isExoticType(type)) {
    if (type === $HYDRATION_BOUNDARY) {
      return `<!--${HYDRATION_BOUNDARY_MARKER}-->${renderToString_internal(
        children,
        el,
        idx
      )}<!--/${HYDRATION_BOUNDARY_MARKER}-->`
    }

    return renderToString_internal(children, el, idx)
  }

  if (typeof type !== "string") {
    node.current = el
    const res = type(props)
    node.current = null
    return renderToString_internal(res, el, idx)
  }

  if (__DEV__) {
    assertValidElementProps(el)
  }
  const attrs = propsToElementAttributes(props)
  const inner =
    "innerHTML" in props
      ? Signal.isSignal(props.innerHTML)
        ? props.innerHTML.peek()
        : props.innerHTML
      : Array.isArray(children)
      ? children.map((c, i) => renderToString_internal(c, el, i)).join("")
      : renderToString_internal(children, el, 0)

  return `<${type}${attrs.length ? ` ${attrs}` : ""}>${
    voidElements.has(type) ? "" : `${inner}</${type}>`
  }`
}

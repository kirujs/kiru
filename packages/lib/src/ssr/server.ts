import { Readable } from "node:stream"
import { Fragment } from "../element.js"
import { renderMode, node } from "../globals.js"
import {
  isVNode,
  encodeHtmlEntities,
  propsToElementAttributes,
  isExoticType,
  assertValidElementProps,
} from "../utils/index.js"
import { Signal } from "../signals/base.js"
import { $HYDRATION_BOUNDARY, voidElements } from "../constants.js"
import { HYDRATION_BOUNDARY_MARKER } from "./hydrationBoundary.js"
import { __DEV__ } from "../env.js"

export function renderToReadableStream(element: JSX.Element): Readable {
  const prev = renderMode.current
  renderMode.current = "stream"
  const stream = new Readable()
  const rootNode = Fragment({ children: element })

  renderToStream_internal(stream, rootNode, null, 0)
  stream.push(null)
  renderMode.current = prev

  return stream
}

function renderToStream_internal(
  stream: Readable,
  el: unknown,
  parent: Kiru.VNode | null,
  idx: number
): void {
  if (el === null) return
  if (el === undefined) return
  if (typeof el === "boolean") return
  if (typeof el === "string") {
    stream.push(encodeHtmlEntities(el))
    return
  }
  if (typeof el === "number" || typeof el === "bigint") {
    stream.push(el.toString())
    return
  }
  if (el instanceof Array) {
    el.forEach((c, i) => renderToStream_internal(stream, c, parent, i))
    return
  }
  if (Signal.isSignal(el)) {
    stream.push(String(el.peek()))
    return
  }
  if (!isVNode(el)) {
    stream.push(String(el))
    return
  }
  el.parent = parent
  el.depth = (parent?.depth ?? -1) + 1
  el.index = idx
  const props = el.props ?? {}
  const children = props.children
  const type = el.type
  if (type === "#text") {
    stream.push(encodeHtmlEntities(props.nodeValue ?? ""))
    return
  }
  if (isExoticType(type)) {
    if (type === $HYDRATION_BOUNDARY) {
      stream.push(`<!--${HYDRATION_BOUNDARY_MARKER}-->`)
      renderToStream_internal(stream, children, el, idx)
      stream.push(`<!--/${HYDRATION_BOUNDARY_MARKER}-->`)
      return
    }
    return renderToStream_internal(stream, children, el, idx)
  }

  if (typeof type !== "string") {
    node.current = el
    const res = type(props)
    node.current = null
    return renderToStream_internal(stream, res, parent, idx)
  }

  if (__DEV__) {
    assertValidElementProps(el)
  }
  const attrs = propsToElementAttributes(props)
  stream.push(`<${type}${attrs.length ? ` ${attrs}` : ""}>`)

  if (!voidElements.has(type)) {
    if ("innerHTML" in props) {
      stream.push(
        String(
          Signal.isSignal(props.innerHTML)
            ? props.innerHTML.peek()
            : props.innerHTML
        )
      )
    } else {
      if (Array.isArray(children)) {
        children.forEach((c, i) => renderToStream_internal(stream, c, el, i))
      } else {
        renderToStream_internal(stream, children, el, 0)
      }
    }

    stream.push(`</${type}>`)
  }
}

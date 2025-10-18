import { node, renderMode } from "./globals.js"
import { Fragment } from "./element.js"
import {
  isVNode,
  encodeHtmlEntities,
  propsToElementAttributes,
  isExoticType,
  assertValidElementProps,
  isRenderInteruptThrowValue,
} from "./utils/index.js"
import { Signal } from "./signals/base.js"
import {
  $ERROR_BOUNDARY,
  $HYDRATION_BOUNDARY,
  voidElements,
} from "./constants.js"
import { HYDRATION_BOUNDARY_MARKER } from "./ssr/hydrationBoundary.js"
import { __DEV__ } from "./env.js"
import { ErrorBoundaryNode } from "./types.utils.js"

interface StringRenderContext {
  write(chunk: string): void
  beginNewBoundary(): number
  resetBoundary(idx: number): void
}

export function renderToString(element: JSX.Element) {
  const prev = renderMode.current
  renderMode.current = "string"
  const parts: string[] = [""]
  const ctx: StringRenderContext = {
    write(chunk) {
      parts[parts.length - 1] += chunk
    },
    beginNewBoundary() {
      parts.push("")
      return parts.length - 1
    },
    resetBoundary(idx) {
      parts[idx] = ""
    },
  }
  renderToString_internal(ctx, Fragment({ children: element }), null, 0)
  renderMode.current = prev
  return parts.join("")
}

function renderToString_internal(
  ctx: StringRenderContext,
  el: unknown,
  parent: Kiru.VNode | null,
  idx: number
): void {
  if (el === null) return
  if (el === undefined) return
  if (typeof el === "boolean") return
  if (typeof el === "string") {
    return ctx.write(encodeHtmlEntities(el))
  }
  if (typeof el === "number" || typeof el === "bigint") {
    return ctx.write(el.toString())
  }
  if (el instanceof Array) {
    return el.forEach((c, i) => renderToString_internal(ctx, c, parent, i))
  }
  if (Signal.isSignal(el)) {
    return ctx.write(String(el.peek()))
  }
  if (!isVNode(el)) {
    return ctx.write(String(el))
  }
  el.parent = parent
  el.depth = (parent?.depth ?? -1) + 1
  el.index = idx
  const { type, props = {} } = el
  if (type === "#text") {
    return ctx.write(encodeHtmlEntities(props.nodeValue ?? ""))
  }

  const children = props.children
  if (isExoticType(type)) {
    if (type === $HYDRATION_BOUNDARY) {
      ctx.write(`<!--${HYDRATION_BOUNDARY_MARKER}-->`)
      renderToString_internal(ctx, children, el, idx)
      ctx.write(`<!--/${HYDRATION_BOUNDARY_MARKER}-->`)
      return
    }

    if (type === $ERROR_BOUNDARY) {
      const boundaryIdx = ctx.beginNewBoundary()
      try {
        renderToString_internal(ctx, children, el, idx)
      } catch (error) {
        if (!isRenderInteruptThrowValue(error)) {
          ctx.resetBoundary(boundaryIdx)
          const e = error instanceof Error ? error : new Error(String(error))
          const { fallback, onError } = props as ErrorBoundaryNode["props"]
          onError?.(e)
          const fallbackContent =
            typeof fallback === "function" ? fallback(e) : fallback
          renderToString_internal(ctx, fallbackContent, el, 0)
        }
      }
      return
    }

    renderToString_internal(ctx, children, el, idx)
    return
  }

  if (typeof type !== "string") {
    try {
      node.current = el
      const res = type(props)
      renderToString_internal(ctx, res, el, idx)
      return
    } catch (error) {
      if (isRenderInteruptThrowValue(error)) {
        return renderToString_internal(ctx, error.fallback, el, 0)
      }
      throw error
    } finally {
      node.current = null
    }
  }

  if (__DEV__) assertValidElementProps(el)
  const attrs = propsToElementAttributes(props)
  ctx.write(`<${type}${attrs.length ? ` ${attrs}` : ""}>`)

  if (voidElements.has(type)) return

  if ("innerHTML" in props) {
    ctx.write(
      String(
        Signal.isSignal(props.innerHTML)
          ? props.innerHTML.peek()
          : props.innerHTML
      )
    )
  } else if (Array.isArray(children)) {
    children.forEach((c, i) => renderToString_internal(ctx, c, el, i))
  } else {
    renderToString_internal(ctx, children, el, 0)
  }
  ctx.write(`</${type}>`)
}

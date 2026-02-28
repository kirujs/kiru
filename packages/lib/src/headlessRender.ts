import { node } from "./globals.js"
import {
  isVNode,
  encodeHtmlEntities,
  propsToElementAttributes,
  isExoticType,
  assertValidElementProps,
  isPrimitiveChild,
  isValidTextChild,
} from "./utils/index.js"
import { isStreamDataThrowValue } from "./statefulPromise.js"
import { Signal } from "./signals/base.js"
import { $ERROR_BOUNDARY, voidElements, $STREAM_DATA } from "./constants.js"
import { __DEV__ } from "./env.js"
import type { ErrorBoundaryNode } from "./types.utils"

export interface HeadlessRenderContext {
  write(chunk: string): void
  onStreamData?: (data: Kiru.StatefulPromiseBase<unknown>[]) => void
}

export function headlessRender(
  ctx: HeadlessRenderContext,
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
    return el.forEach((c, i) => headlessRender(ctx, c, parent, i))
  }
  if (Signal.isSignal(el)) {
    const value = el.peek()
    if (!isPrimitiveChild(value)) {
      if (__DEV__) {
        console.error(`[kiru]: expected primitive child but received ${value}`)
      }
      return
    }

    if (isValidTextChild(value)) {
      ctx.write(encodeHtmlEntities(String(value)))
    }
    return
  }
  if (!isVNode(el)) {
    return
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
    if (type === $ERROR_BOUNDARY) {
      let boundaryBuffer = ""
      const streamPromises = new Set<Kiru.StatefulPromiseBase<unknown>>()
      const boundaryCtx: HeadlessRenderContext = {
        write(chunk) {
          boundaryBuffer += chunk
        },
        onStreamData(data) {
          data.forEach((p) => streamPromises.add(p))
        },
      }
      try {
        headlessRender(boundaryCtx, children, el, idx)
        // flush successful render
        ctx.write(boundaryBuffer)
        ctx.onStreamData?.([...streamPromises])
      } catch (error) {
        if (isStreamDataThrowValue(error)) {
          throw error
        }
        const e = error instanceof Error ? error : new Error(String(error))
        const { fallback, onError } = props as ErrorBoundaryNode["props"]
        onError?.(e)
        const fallbackContent =
          typeof fallback === "function" ? fallback(e) : fallback
        headlessRender(ctx, fallbackContent, el, 0)
      }
      return
    }

    headlessRender(ctx, children, el, idx)
    return
  }

  if (typeof type === "function") {
    try {
      node.current = el
      let children = type(props)
      if (typeof children === "function") {
        children = children(props)
      }
      headlessRender(ctx, children, el, idx)
      return
    } catch (error) {
      if (isStreamDataThrowValue(error)) {
        const { fallback, data } = error[$STREAM_DATA]
        ctx.onStreamData?.(data)
        return headlessRender(ctx, fallback, el, 0)
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
    children.forEach((c, i) => headlessRender(ctx, c, el, i))
  } else {
    headlessRender(ctx, children, el, 0)
  }
  ctx.write(`</${type}>`)
}

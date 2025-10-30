import { node, hookIndex } from "./globals.js"
import {
  isVNode,
  encodeHtmlEntities,
  propsToElementAttributes,
  isExoticType,
  assertValidElementProps,
  isPrimitiveChild,
} from "./utils/index.js"
import { Signal } from "./signals/base.js"
import { $ERROR_BOUNDARY, voidElements, $SUSPENSE_THROW } from "./constants.js"
import { __DEV__ } from "./env.js"
import { isSuspenseThrowValue } from "./components/suspense.js"
import type { ErrorBoundaryNode } from "./types.utils"

export interface RecursiveRenderContext {
  write(chunk: string): void
  onPending?: (data: Kiru.StatefulPromise<unknown>[]) => void
}

export function recursiveRender(
  ctx: RecursiveRenderContext,
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
    return el.forEach((c, i) => recursiveRender(ctx, c, parent, i))
  }
  if (Signal.isSignal(el)) {
    const value = el.peek()
    if (__DEV__) {
      if (!isPrimitiveChild(value)) {
        if (__DEV__) {
          console.error(
            `[kiru]: expected primitive child but received ${value}`
          )
        }
        return
      }
    }
    return ctx.write(encodeHtmlEntities(String(value)))
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
      const pending = new Set<Kiru.StatefulPromise<unknown>>()
      const boundaryCtx: RecursiveRenderContext = {
        write(chunk) {
          boundaryBuffer += chunk
        },
        onPending(data) {
          data.forEach((p) => pending.add(p))
        },
      }
      try {
        recursiveRender(boundaryCtx, children, el, idx)
        // flush successful render
        ctx.write(boundaryBuffer)
        ctx.onPending?.([...pending])
      } catch (error) {
        if (isSuspenseThrowValue(error)) {
          throw error
        }
        const e = error instanceof Error ? error : new Error(String(error))
        const { fallback, onError } = props as ErrorBoundaryNode["props"]
        onError?.(e)
        const fallbackContent =
          typeof fallback === "function" ? fallback(e) : fallback
        recursiveRender(ctx, fallbackContent, el, 0)
      }
      return
    }

    recursiveRender(ctx, children, el, idx)
    return
  }

  if (typeof type !== "string") {
    try {
      hookIndex.current = 0
      node.current = el
      const res = type(props)
      recursiveRender(ctx, res, el, idx)
      return
    } catch (error) {
      if (isSuspenseThrowValue(error)) {
        const { fallback, pending } = error[$SUSPENSE_THROW]
        ctx.onPending?.(pending)
        return recursiveRender(ctx, fallback, el, 0)
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
    children.forEach((c, i) => recursiveRender(ctx, c, el, i))
  } else {
    recursiveRender(ctx, children, el, 0)
  }
  ctx.write(`</${type}>`)
}

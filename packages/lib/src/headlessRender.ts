import { node } from "./globals.js"
import {
  isVNode,
  encodeHtmlEntities,
  propsToElementAttributes,
  isExoticType,
  assertValidElementProps,
  isPrimitiveChild,
  isValidTextChild,
  isStreamDataThrowValue,
} from "./utils/index.js"
import { isSignal } from "./signals/base.js"
import {
  $ERROR_BOUNDARY,
  voidElements,
  $STREAM_DATA,
  $INLINE_FN,
} from "./constants.js"
import { __DEV__ } from "./env.js"
import type { ErrorBoundaryNode, InlineFnNode } from "./types.utils.js"
import { createElement } from "./element.js"
import { isTemplateRoot, type TemplateRoot } from "./template.js"
import { KIRU_HOLE_MARKER } from "./utils/staticHtml.js"

export interface HeadlessRenderContext {
  write(chunk: string): void
  onStreamData?: (data: Kiru.StatefulPromise<unknown>[]) => void
  scheduleSpeculativeContinue?: (
    pending: Kiru.StatefulPromise<unknown>[],
    continueRender: () => JSX.Element,
    anchorVNode: Kiru.VNode
  ) => void
}

export type SpeculativeTraverseContext = Pick<
  HeadlessRenderContext,
  "onStreamData" | "scheduleSpeculativeContinue"
>

function renderHeadlessChildNodes(
  ctx: HeadlessRenderContext,
  children: unknown,
  parent: Kiru.VNode
): void {
  if (children == null || children === false) return
  if (Array.isArray(children)) {
    children.forEach((c, i) => headlessRender(ctx, c, parent, i))
    return
  }
  headlessRender(ctx, children, parent, 0)
}

export function headlessRender(
  ctx: HeadlessRenderContext,
  el: unknown,
  parent: Kiru.VNode | null = null,
  idx: number = 0
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
  if (typeof el === "function") {
    return headlessRender(
      ctx,
      createElement($INLINE_FN, { expr: el }),
      parent,
      idx
    )
  }
  if (isTemplateRoot(el)) {
    return renderTemplateRoot(ctx, el)
  }
  if (isSignal(el)) {
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

  let children = props.children
  if (isExoticType(type)) {
    if (type === $ERROR_BOUNDARY) {
      let boundaryBuffer = ""
      const streamPromises = new Set<Kiru.StatefulPromise<unknown>>()
      const boundaryCtx: HeadlessRenderContext = {
        write(chunk) {
          boundaryBuffer += chunk
        },
        onStreamData(data) {
          data.forEach((p) => streamPromises.add(p))
        },
      }
      try {
        renderHeadlessChildNodes(boundaryCtx, children, el)
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
    } else if (type === $INLINE_FN) {
      node.current = el
      let render = (props as InlineFnNode["props"]).expr
      try {
        children = render()
      } finally {
        node.current = null
      }
    }

    renderHeadlessChildNodes(ctx, children, el)
    return
  }

  if (typeof type === "function") {
    try {
      node.current = el
      let children = type(props)
      if (typeof children === "function") {
        children = children(props)
      }
      renderHeadlessChildNodes(ctx, children, el)
      return
    } catch (error) {
      if (isStreamDataThrowValue(error)) {
        const { fallback, data, continue: continueRender } = error[$STREAM_DATA]
        ctx.scheduleSpeculativeContinue?.(data, continueRender, el)
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
        isSignal(props.innerHTML) ? props.innerHTML.peek() : props.innerHTML
      )
    )
  } else if (Array.isArray(children)) {
    children.forEach((c, i) => headlessRender(ctx, c, el, i))
  } else {
    headlessRender(ctx, children, el, 0)
  }
  ctx.write(`</${type}>`)
}

function renderTemplateRoot(
  ctx: HeadlessRenderContext,
  template: TemplateRoot
): void {
  const holeCount = template.holeCount ?? 0
  const holeChildren = template.holeChildren
  if (holeCount === 0 || !holeChildren?.length) {
    ctx.write(template.html)
    return
  }
  let pos = 0
  for (let i = 0; i < holeCount; i++) {
    const markerAt = template.html.indexOf(KIRU_HOLE_MARKER, pos)
    if (markerAt < 0) {
      if (__DEV__) {
        console.error(
          `[kiru]: template missing hole marker ${KIRU_HOLE_MARKER} for hole ${i}`
        )
      }
      break
    }
    ctx.write(template.html.slice(pos, markerAt + KIRU_HOLE_MARKER.length))
    headlessRender(ctx, holeChildren[i], undefined, i)
    pos = markerAt + KIRU_HOLE_MARKER.length
  }
  ctx.write(template.html.slice(pos))
}

function renderSpeculativeChildNodes(
  ctx: SpeculativeTraverseContext,
  children: unknown,
  parent: Kiru.VNode
): void {
  if (children == null || children === false) return
  if (Array.isArray(children)) {
    children.forEach((c, i) => speculativeTraverse(ctx, c, parent, i))
    return
  }
  speculativeTraverse(ctx, children, parent, 0)
}

/**
 * Walks the tree after stream promises settle to discover nested stream
 * resources. Skips HTML serialization entirely (no tags, attrs, or encoding).
 */
export function speculativeTraverse(
  ctx: SpeculativeTraverseContext,
  el: unknown,
  parent: Kiru.VNode | null = null,
  idx: number = 0
): void {
  if (el === null || el === undefined || typeof el === "boolean") return
  if (
    typeof el === "string" ||
    typeof el === "number" ||
    typeof el === "bigint"
  ) {
    return
  }
  if (el instanceof Array) {
    return el.forEach((c, i) => speculativeTraverse(ctx, c, parent, i))
  }
  if (typeof el === "function") {
    return speculativeTraverse(
      ctx,
      createElement($INLINE_FN, { expr: el }),
      parent,
      idx
    )
  }
  if (isSignal(el)) return
  if (!isVNode(el)) return

  el.parent = parent
  el.depth = (parent?.depth ?? -1) + 1
  el.index = idx
  const { type, props = {} } = el
  if (type === "#text") return

  let children = props.children
  if (isExoticType(type)) {
    if (type === $ERROR_BOUNDARY) {
      const streamPromises = new Set<Kiru.StatefulPromise<unknown>>()
      const boundaryCtx: SpeculativeTraverseContext = {
        onStreamData(data) {
          data.forEach((p) => streamPromises.add(p))
        },
        scheduleSpeculativeContinue: ctx.scheduleSpeculativeContinue,
      }
      try {
        speculativeTraverse(boundaryCtx, children, el, idx)
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
        speculativeTraverse(ctx, fallbackContent, el, 0)
      }
      return
    }
    if (type === $INLINE_FN) {
      node.current = el
      const render = (props as InlineFnNode["props"]).expr
      try {
        children = render()
      } finally {
        node.current = null
      }
    }
    renderSpeculativeChildNodes(ctx, children, el)
    return
  }

  if (typeof type === "function") {
    try {
      node.current = el
      let result = type(props)
      if (typeof result === "function") {
        result = result(props)
      }
      renderSpeculativeChildNodes(ctx, result, el)
      return
    } catch (error) {
      if (isStreamDataThrowValue(error)) {
        const { data, continue: continueRender } = error[$STREAM_DATA]
        ctx.scheduleSpeculativeContinue?.(data, continueRender, el)
        ctx.onStreamData?.(data)
        return
      }
      throw error
    } finally {
      node.current = null
    }
  }

  if ("innerHTML" in props) return

  if (Array.isArray(children)) {
    children.forEach((c, i) => speculativeTraverse(ctx, c, el, i))
  } else {
    speculativeTraverse(ctx, children, el, 0)
  }
}

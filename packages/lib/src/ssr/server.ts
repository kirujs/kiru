import { Readable } from "node:stream"
import { Fragment } from "../element.js"
import { renderMode, node, hookIndex } from "../globals.js"
import {
  isVNode,
  encodeHtmlEntities,
  propsToElementAttributes,
  isExoticType,
  assertValidElementProps,
} from "../utils/index.js"
import { Signal } from "../signals/base.js"
import {
  $HYDRATION_BOUNDARY,
  $ERROR_BOUNDARY,
  PREFETCHED_DATA_EVENT,
  voidElements,
} from "../constants.js"
import { HYDRATION_BOUNDARY_MARKER } from "./hydrationBoundary.js"
import { __DEV__ } from "../env.js"
import type { ErrorBoundaryNode } from "../types.utils"
import { isSuspenseThrowValue } from "../components/suspense.js"

interface ServerRenderContext {
  write: (chunk: string) => void
  queuePendingData: (data: Kiru.StatefulPromise<unknown>[]) => void
}

const PREFETCH_EVENTS_SETUP = `
<script type="text/javascript">
const d = document,
  m = (window["${PREFETCHED_DATA_EVENT}"] ??= new Map());
d.querySelectorAll("[x-data]").forEach((p) => {
  const id = p.getAttribute("id");
  const { data, error } = JSON.parse(p.innerHTML);
  m.set(id, { data, error });
  const event = new CustomEvent("${PREFETCHED_DATA_EVENT}", { detail: { id, data, error } });
  window.dispatchEvent(event);
  p.remove();
});
d.currentScript.remove()
</script>
`

export function renderToReadableStream(element: JSX.Element): {
  immediate: string
  stream: Readable
} {
  const stream = new Readable({ read() {} })
  const rootNode = Fragment({ children: element })
  const prefetchPromises = new Set<Kiru.StatefulPromise<unknown>>()
  const prefetchWritePromises: Promise<unknown>[] = []

  let immediate = ""

  const ctx: ServerRenderContext = {
    write: (chunk) => (immediate += chunk),
    queuePendingData(data) {
      data
        .filter((p) => !prefetchPromises.has(p))
        .forEach((p) => {
          prefetchPromises.add(p)

          const writePromise = p
            .then(() => ({ data: p.value }))
            .catch(() => ({ error: p.error?.message }))
            .then((value) => {
              const content = JSON.stringify(value)
              stream.push(
                `<script id="${p.id}" x-data type="application/json">${content}</script>`
              )
            })

          prefetchWritePromises.push(writePromise)
        })
    },
  }

  const prev = renderMode.current
  renderMode.current = "stream"
  renderToStream_internal(ctx, rootNode, null, 0)
  renderMode.current = prev

  if (prefetchWritePromises.length > 0) {
    Promise.all(prefetchWritePromises).then(() => {
      stream.push(PREFETCH_EVENTS_SETUP)
      stream.push(null)
    })
  } else {
    stream.push(null)
  }

  return { immediate, stream }
}

function renderToStream_internal(
  ctx: ServerRenderContext,
  el: unknown,
  parent: Kiru.VNode | null,
  idx: number
): void {
  if (el === null || el === undefined || typeof el === "boolean") return
  if (typeof el === "string") return ctx.write(encodeHtmlEntities(el))
  if (typeof el === "number" || typeof el === "bigint")
    return ctx.write(el.toString())
  if (el instanceof Array)
    return el.forEach((c, i) => renderToStream_internal(ctx, c, parent, i))
  if (Signal.isSignal(el)) return ctx.write(String(el.peek()))
  if (!isVNode(el)) return ctx.write(String(el))

  el.parent = parent
  el.depth = (parent?.depth ?? -1) + 1
  el.index = idx
  const { type, props = {} } = el
  const children = props.children

  if (type === "#text")
    return ctx.write(encodeHtmlEntities(props.nodeValue ?? ""))

  if (isExoticType(type)) {
    if (type === $HYDRATION_BOUNDARY) {
      ctx.write(`<!--${HYDRATION_BOUNDARY_MARKER}-->`)
      renderToStream_internal(ctx, children, el, idx)
      ctx.write(`<!--/${HYDRATION_BOUNDARY_MARKER}-->`)
      return
    }

    if (type === $ERROR_BOUNDARY) {
      let boundaryBuffer = ""
      const localPromises = new Set<Kiru.StatefulPromise<unknown>>()

      const boundaryCtx: ServerRenderContext = {
        write(chunk) {
          boundaryBuffer += chunk
        },
        queuePendingData(data) {
          data.forEach((p) => localPromises.add(p))
        },
      }

      try {
        renderToStream_internal(boundaryCtx, children, el, idx)
        // flush successful render
        ctx.write(boundaryBuffer)
        // merge local promises into global queue
        ctx.queuePendingData([...localPromises])
      } catch (error) {
        if (isSuspenseThrowValue(error)) {
          throw error
        }
        const e = error instanceof Error ? error : new Error(String(error))
        const { fallback, onError } = props as ErrorBoundaryNode["props"]
        onError?.(e)
        const fallbackContent =
          typeof fallback === "function" ? fallback(e) : fallback
        renderToStream_internal(ctx, fallbackContent, el, 0)
      }
      return
    }

    // other exotic types
    return renderToStream_internal(ctx, children, el, idx)
  }

  if (typeof type !== "string") {
    try {
      hookIndex.current = 0
      node.current = el
      const res = type(props)
      return renderToStream_internal(ctx, res, el, idx)
    } catch (error) {
      if (isSuspenseThrowValue(error)) {
        const { fallback, pendingData } = error
        if (pendingData) ctx.queuePendingData(pendingData)
        renderToStream_internal(ctx, fallback, el, 0)
        return
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
    children.forEach((c, i) => renderToStream_internal(ctx, c, el, i))
  } else {
    renderToStream_internal(ctx, children, el, 0)
  }
  ctx.write(`</${type}>`)
}

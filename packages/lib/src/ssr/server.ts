import { Readable } from "node:stream"
import { Fragment } from "../element.js"
import { renderMode, node, hookIndex } from "../globals.js"
import {
  isVNode,
  encodeHtmlEntities,
  propsToElementAttributes,
  isExoticType,
  assertValidElementProps,
  isRenderInteruptThrowValue,
} from "../utils/index.js"
import { Signal } from "../signals/base.js"
import {
  $HYDRATION_BOUNDARY,
  HYDRATION_DATA_EVENT,
  voidElements,
} from "../constants.js"
import { HYDRATION_BOUNDARY_MARKER } from "./hydrationBoundary.js"
import { __DEV__ } from "../env.js"

interface ServerRenderContext {
  stream: Readable
  queuePendingData: (data: Kiru.StatefulPromise<unknown>[]) => void
}

const PROMISE_HYDRATION_PREAMBLE = `
<script type="text/javascript" defer>
const promiseCache = window.__KIRU_PROMISE_CACHE = new Map();
const dataScripts = window.document.querySelectorAll("[x-data]");
dataScripts.forEach((p) => {
  const id = p.getAttribute("id");
  const { data, error } = JSON.parse(p.innerHTML);
  promiseCache.set(id, { id, data, error });
  const event = new CustomEvent("${HYDRATION_DATA_EVENT}", { detail: { id, data, error } });
  window.dispatchEvent(event);
  p.remove();
});
document.currentScript.remove();
</script>
`
export function renderToReadableStream(element: JSX.Element): Readable {
  const stream = new Readable({
    read() {},
  })
  const rootNode = Fragment({ children: element })
  const seenPromises = new Set<Kiru.StatefulPromise<unknown>>()
  const pendingWrites: Promise<unknown>[] = []

  const ctx: ServerRenderContext = {
    stream,
    queuePendingData(data) {
      const unseen = data.filter((p) => !seenPromises.has(p))
      if (unseen.length === 0) return

      unseen.forEach((p) => {
        seenPromises.add(p)

        const writePromise = p.then(() => {
          const contents = JSON.stringify({
            data: p.value,
            error: p.error,
          })

          const chunk = `<script id="${p.id}" x-data type="application/json" defer>${contents}</script>`
          stream.push(chunk)
          console.log("wrote data chunk", p.id)
        })
        pendingWrites.push(writePromise)
      })
    },
  }

  const prev = renderMode.current
  renderMode.current = "stream"
  renderToStream_internal(ctx, rootNode, null, 0)
  renderMode.current = prev

  if (pendingWrites.length > 0) {
    console.log("pending writes", pendingWrites.length)
    Promise.all(pendingWrites).then(() => {
      stream.push(PROMISE_HYDRATION_PREAMBLE)
      stream.push(null)
      console.log("end stream")
    })
  } else {
    stream.push(null)
    console.log("end stream")
  }

  return stream
}

function renderToStream_internal(
  ctx: ServerRenderContext,
  el: unknown,
  parent: Kiru.VNode | null,
  idx: number
): void {
  if (el === null) return
  if (el === undefined) return
  if (typeof el === "boolean") return
  const { stream } = ctx
  if (typeof el === "string") {
    stream.push(encodeHtmlEntities(el))
    return
  }
  if (typeof el === "number" || typeof el === "bigint") {
    stream.push(el.toString())
    return
  }
  if (el instanceof Array) {
    el.forEach((c, i) => renderToStream_internal(ctx, c, parent, i))
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
  const { type, props = {} } = el
  const children = props.children
  if (type === "#text") {
    stream.push(encodeHtmlEntities(props.nodeValue ?? ""))
    return
  }
  if (isExoticType(type)) {
    if (type === $HYDRATION_BOUNDARY) {
      stream.push(`<!--${HYDRATION_BOUNDARY_MARKER}-->`)
      renderToStream_internal(ctx, children, el, idx)
      stream.push(`<!--/${HYDRATION_BOUNDARY_MARKER}-->`)
      return
    }
    return renderToStream_internal(ctx, children, el, idx)
  }

  if (typeof type !== "string") {
    try {
      hookIndex.current = 0
      node.current = el
      const res = type(props)
      return renderToStream_internal(ctx, res, el, idx)
    } catch (error) {
      if (isRenderInteruptThrowValue(error)) {
        const { fallback, pendingData } = error
        if (pendingData) {
          ctx.queuePendingData(pendingData)
        }
        renderToStream_internal(ctx, fallback, el, 0)
        return
      }
      throw error
    } finally {
      node.current = null
    }
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
        children.forEach((c, i) => renderToStream_internal(ctx, c, el, i))
      } else {
        renderToStream_internal(ctx, children, el, 0)
      }
    }

    stream.push(`</${type}>`)
  }
}

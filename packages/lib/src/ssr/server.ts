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
  write: (chunk: string) => void
  queuePendingData: (data: Kiru.StatefulPromise<unknown>[]) => void
}

const PROMISE_HYDRATION_PREAMBLE = `
<script type="text/javascript">
const dataScripts = window.document.querySelectorAll("[x-data]");
dataScripts.forEach((p) => {
  const id = p.getAttribute("id");
  const { data, error } = JSON.parse(p.innerHTML);
  const event = new CustomEvent("${HYDRATION_DATA_EVENT}", { detail: { id, data, error } });
  window.dispatchEvent(event);
  p.remove();
});
document.currentScript.remove()
</script>
`
export function renderToReadableStream(element: JSX.Element): {
  immediate: string
  stream: Readable
} {
  const stream = new Readable({ read() {} })
  const rootNode = Fragment({ children: element })
  const seenPromises = new Set<Kiru.StatefulPromise<unknown>>()
  const pendingWrites: Promise<unknown>[] = []

  let immediate = ""

  const ctx: ServerRenderContext = {
    write: (chunk) => (immediate += chunk),
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

          stream.push(
            `<script id="${p.id}" x-data type="application/json" defer>${contents}</script>`
          )
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
    Promise.all(pendingWrites).then(() => {
      stream.push(PROMISE_HYDRATION_PREAMBLE)
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
  if (el === null) return
  if (el === undefined) return
  if (typeof el === "boolean") return
  if (typeof el === "string") {
    ctx.write(encodeHtmlEntities(el))
    return
  }
  if (typeof el === "number" || typeof el === "bigint") {
    ctx.write(el.toString())
    return
  }
  if (el instanceof Array) {
    el.forEach((c, i) => renderToStream_internal(ctx, c, parent, i))
    return
  }
  if (Signal.isSignal(el)) {
    ctx.write(String(el.peek()))
    return
  }
  if (!isVNode(el)) {
    ctx.write(String(el))
    return
  }
  el.parent = parent
  el.depth = (parent?.depth ?? -1) + 1
  el.index = idx
  const { type, props = {} } = el
  const children = props.children
  if (type === "#text") {
    ctx.write(encodeHtmlEntities(props.nodeValue ?? ""))
    return
  }
  if (isExoticType(type)) {
    if (type === $HYDRATION_BOUNDARY) {
      ctx.write(`<!--${HYDRATION_BOUNDARY_MARKER}-->`)
      renderToStream_internal(ctx, children, el, idx)
      ctx.write(`<!--/${HYDRATION_BOUNDARY_MARKER}-->`)
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
  ctx.write(`<${type}${attrs.length ? ` ${attrs}` : ""}>`)

  if (!voidElements.has(type)) {
    if ("innerHTML" in props) {
      ctx.write(
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

    ctx.write(`</${type}>`)
  }
}

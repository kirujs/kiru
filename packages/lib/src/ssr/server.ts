import { Readable } from "node:stream"
import { Fragment } from "../element.js"
import { renderMode } from "../globals.js"
import { PREFETCHED_DATA_EVENT } from "../constants.js"
import { __DEV__ } from "../env.js"
import { recursiveRender, RecursiveRenderContext } from "../recursiveRender.js"

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
  const pendingWritePromises: Promise<unknown>[] = []

  let immediate = ""

  const ctx: RecursiveRenderContext = {
    write: (chunk) => (immediate += chunk),
    onPending(data) {
      for (const promise of data) {
        if (prefetchPromises.has(promise)) continue
        prefetchPromises.add(promise)

        const writePromise = promise
          .then(() => ({ data: promise.value }))
          .catch(() => ({ error: promise.error?.message }))
          .then((value) => {
            const content = JSON.stringify(value)
            stream.push(
              `<script id="${promise.id}" x-data type="application/json">${content}</script>`
            )
          })

        pendingWritePromises.push(writePromise)
      }
    },
  }

  const prev = renderMode.current
  renderMode.current = "stream"
  recursiveRender(ctx, rootNode, null, 0)
  renderMode.current = prev

  if (pendingWritePromises.length > 0) {
    Promise.all(pendingWritePromises).then(() => {
      stream.push(PREFETCH_EVENTS_SETUP)
      stream.push(null)
    })
  } else {
    stream.push(null)
  }

  return { immediate, stream }
}

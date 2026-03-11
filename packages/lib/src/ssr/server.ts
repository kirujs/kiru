import { Fragment } from "../element.js"
import { renderMode } from "../globals.js"
import { STREAMED_DATA_EVENT } from "../constants.js"
import { headlessRender, HeadlessRenderContext } from "../headlessRender.js"

const STREAMED_DATA_SETUP = `
<script type="text/javascript">
const d = document,
  m = (window["${STREAMED_DATA_EVENT}"] ??= new Map());
d.querySelectorAll("[k-data]").forEach((p) => {
  const id = p.getAttribute("id");
  const { data, error } = JSON.parse(p.innerHTML);
  m.set(id, { data, error });
  const event = new CustomEvent("${STREAMED_DATA_EVENT}", { detail: { id, data, error } });
  window.dispatchEvent(event);
  p.remove();
});
d.currentScript.remove()
</script>
`

export interface ReadableStreamRenderResult {
  immediate: string
  stream: ReadableStream
}

export function renderToReadableStream(element: JSX.Element): ReadableStreamRenderResult {
  let controller!: ReadableStreamDefaultController<string>
  const stream = new ReadableStream<string>({
    start(c) {
      controller = c
    },
  })
  
  const rootNode = Fragment({ children: element })
  const streamPromises = new Set<Kiru.StatefulPromise<unknown>>()
  const pendingWritePromises: Promise<void>[] = []

  let immediate = ""

  const ctx: HeadlessRenderContext = {
    write: (chunk) => (immediate += chunk),
    onStreamData(data) {
      for (const promise of data) {
        if (streamPromises.has(promise)) continue
        streamPromises.add(promise)

        const writePromise = promise
          .then(() => ({ data: promise.value }))
          .catch(() => ({ error: promise.error?.message }))
          .then((value) => {
            const content = JSON.stringify(value)
            controller.enqueue(
              `<script id="${promise.id}" k-data type="application/json">${content}</script>`
            )
          })

        pendingWritePromises.push(writePromise)
      }
    },
  }

  const prev = renderMode.current
  renderMode.current = "stream"
  headlessRender(ctx, rootNode)
  renderMode.current = prev

  if (pendingWritePromises.length > 0) {
    Promise.all(pendingWritePromises).then(() => {
      controller.enqueue(STREAMED_DATA_SETUP)
      controller.close()
    })
  } else {
    controller.close()
  }

  return { immediate, stream }
}

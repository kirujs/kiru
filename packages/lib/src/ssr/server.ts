import { Fragment } from "../element.js"
import { renderMode } from "../globals.js"
import { STREAMED_DATA_EVENT } from "../constants.js"
import { headlessRender, HeadlessRenderContext } from "../headlessRender.js"

const STREAMED_DATA_SETUP = `
<script type="text/javascript">
const d = document, w = window, m = (w["${STREAMED_DATA_EVENT}"] ??= new Map());
w.__$k_data = (id, data) => {
  m.set(id, data);
  w.dispatchEvent(new CustomEvent("${STREAMED_DATA_EVENT}", { detail: { id, ...data } }));
  d.currentScript.remove();
};
d.currentScript.remove()
</script>
`.replace(/\s+/g, " ")

export function renderToReadableStream(
  element: JSX.Element
): ReadableStream<string> {
  let controller!: ReadableStreamDefaultController<string>
  const stream = new ReadableStream<string>({
    start(c) {
      controller = c
    },
  })

  const rootNode = Fragment({ children: element })
  const streamPromises = new Set<Kiru.StatefulPromise<unknown>>()
  const pendingWritePromises: Promise<void>[] = []
  let didQueueStreamedDataSetup = false

  const ctx: HeadlessRenderContext = {
    write: (chunk) => controller.enqueue(chunk),
    onStreamData(data) {
      if (!didQueueStreamedDataSetup) {
        controller.enqueue(STREAMED_DATA_SETUP)
        didQueueStreamedDataSetup = true
      }
      for (const promise of data) {
        if (streamPromises.has(promise)) continue
        streamPromises.add(promise)

        const writePromise = promise
          .then(() => ({ data: promise.value }))
          .catch(() => ({ error: promise.error?.message }))
          .then((value) => {
            controller.enqueue(
              `<script type="text/javascript">__$k_data("${promise.id}",${JSON.stringify(value)})</script>`
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

  Promise.all(pendingWritePromises).then(() => controller.close())
  return stream
}

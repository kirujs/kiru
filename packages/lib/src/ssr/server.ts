import { Fragment } from "../element.js"
import { renderMode } from "../globals.js"
import { STREAMED_DATA_EVENT } from "../constants.js"
import { __DEV__ } from "../env.js"
import { headlessRender, HeadlessRenderContext } from "../recursiveRender.js"

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
`.replace(/\s+/g, " ")

export function renderToReadableStream(element: JSX.Element): {
  immediate: string
  stream: ReadableStream | null
} {
  const streamPromises = new Set<Kiru.StatefulPromise<unknown>>()
  const dataPromises: Promise<string>[] = []
  let stream: ReadableStream | null = null

  let immediate = ""

  const ctx: HeadlessRenderContext = {
    write: (chunk) => (immediate += chunk),
    onStreamData(data) {
      for (const promise of data) {
        if (streamPromises.has(promise)) continue
        streamPromises.add(promise)

        const dataPromise = promise
          .then(() => ({ data: promise.value }))
          .catch(() => ({ error: promise.error?.message }))
          .then(
            (value, content = JSON.stringify(value)) =>
              `<script id="${promise.id}" k-data type="application/json">${content}</script>`
          )
        dataPromises.push(dataPromise)
      }
    },
  }

  const prev = renderMode.current
  renderMode.current = "stream"
  headlessRender(ctx, Fragment({ children: element }), null, 0)
  renderMode.current = prev

  if (dataPromises.length > 0) {
    stream = new ReadableStream({
      async pull(controller) {
        for await (const chunk of dataPromises) {
          controller.enqueue(chunk)
        }
        controller.enqueue(STREAMED_DATA_SETUP)
        controller.close()
      },
    })
  }

  return { immediate, stream }
}

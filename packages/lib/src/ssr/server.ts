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

interface RenderToReadableStreamConfig {
  /**
   * Include additional data to stream - must be resolved on the client manually.
   */
  data?: Kiru.StatefulPromise<unknown>[]
}

export function renderToReadableStream(
  element: JSX.Element,
  config: RenderToReadableStreamConfig = {}
): {
  immediate: string
  stream: ReadableStream | null
} {
  const streamData = createStreamDataHandler()
  if (config.data) {
    streamData.enqueue(config.data)
  }

  let immediate = ""
  const ctx: HeadlessRenderContext = {
    write: (chunk) => (immediate += chunk),
    onStreamData: streamData.enqueue,
  }

  const prev = renderMode.current
  renderMode.current = "stream"
  headlessRender(ctx, Fragment({ children: element }), null, 0)
  renderMode.current = prev

  let stream: ReadableStream | null = null
  if (streamData.chunks.length > 0) {
    stream = new ReadableStream({
      async pull(controller) {
        for await (const chunk of streamData.chunks) {
          controller.enqueue(chunk)
        }
        controller.enqueue(STREAMED_DATA_SETUP)
        controller.close()
      },
    })
  }

  return { immediate, stream }
}

interface StreamDataHandler {
  enqueue: NonNullable<HeadlessRenderContext["onStreamData"]>
  chunks: Promise<string>[]
}

function createStreamDataHandler(): StreamDataHandler {
  const seen = new Set<Kiru.StatefulPromise<unknown>>()
  const chunks: Promise<string>[] = []

  return {
    chunks,
    enqueue: (items) => {
      for (const item of items) {
        if (seen.has(item)) continue
        seen.add(item)

        const chunk = item
          .then(() => ({ data: item.value }))
          .catch(() => ({ error: item.error?.message }))
          .then(
            (value, content = JSON.stringify(value)) =>
              `<script id="${item.id}" k-data type="application/json">${content}</script>`
          )
        chunks.push(chunk)
      }
    },
  }
}

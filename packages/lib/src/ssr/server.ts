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

export interface RenderToReadableStreamOptions {
  /**
   * Invoked once the synchronous shell render is complete, with the full
   * shell HTML buffered into a string. Whatever the callback writes to the
   * supplied controller becomes the first emission(s) of the stream;
   * streamed data scripts are then appended as their resolving promises
   * settle.
   *
   * Use this to assemble surrounding template fragments (prefix/suffix),
   * inject CSS into the shell, or otherwise transform the static portion
   * of the document atomically. Crucially, this lets streaming SSR flush
   * the document close tags (`</body></html>`) *before* the async data
   * scripts arrive, so the HTML parser sees `</html>` early and any
   * implicitly-deferred `<script type="module">` entry tag can hydrate
   * without waiting for the slowest in-flight resource.
   *
   * If omitted, the shell is enqueued verbatim as the first chunk.
   *
   * May be sync or async; data-script enqueues wait until this resolves.
   */
  onShellReady?: (
    shell: string,
    controller: ReadableStreamDefaultController<string>
  ) => void | Promise<void>
}

export function renderToReadableStream(
  element: JSX.Element,
  options?: RenderToReadableStreamOptions
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

  // Buffer sync shell writes so the caller can transform / wrap the whole
  // shell in `onShellReady` instead of intercepting individual chunks.
  let shellBuffer = ""
  let resolveShellFlushed!: () => void
  const shellFlushed = new Promise<void>((r) => {
    resolveShellFlushed = r
  })

  const ctx: HeadlessRenderContext = {
    write: (chunk) => {
      shellBuffer += chunk
    },
    onStreamData(data) {
      if (!didQueueStreamedDataSetup) {
        // The setup script primes `window.__$k_data`. It must execute
        // before any `__$k_data(...)` callsite, so it belongs in the
        // shell (which is flushed first), not in the streamed data tail.
        shellBuffer += STREAMED_DATA_SETUP
        didQueueStreamedDataSetup = true
      }
      for (const promise of data) {
        if (streamPromises.has(promise)) continue
        streamPromises.add(promise)

        const writePromise = promise
          .then(() => ({ data: promise.value }))
          .catch(() => ({ error: promise.error?.message }))
          .then(async (value) => {
            // Hold each data-script enqueue until the shell is flushed,
            // even if `onShellReady` is async. Without this, a fast-
            // resolving promise could race ahead of the shell.
            await shellFlushed
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
  try {
    headlessRender(ctx, rootNode)
  } finally {
    renderMode.current = prev
  }

  void (async () => {
    try {
      if (options?.onShellReady) {
        await options.onShellReady(shellBuffer, controller)
      } else {
        controller.enqueue(shellBuffer)
      }
    } catch (error) {
      controller.error(error)
      return
    } finally {
      resolveShellFlushed()
    }
    try {
      await Promise.all(pendingWritePromises)
      controller.close()
    } catch (error) {
      controller.error(error)
    }
  })()

  return stream
}

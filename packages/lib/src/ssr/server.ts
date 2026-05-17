import { Fragment } from "../element.js"
import { renderMode } from "../globals.js"
import { STREAMED_DATA_DESCENDANTS, STREAMED_DATA_EVENT } from "../constants.js"
import { withSpeculativeStreamPromiseCollector } from "../resource.js"
import {
  headlessRender,
  speculativeTraverse,
  HeadlessRenderContext,
  SpeculativeTraverseContext,
} from "../headlessRender.js"

const STREAMED_DATA_SETUP = `
<script type="text/javascript">
const e="${STREAMED_DATA_EVENT}",d=document,w=window,m=(w[e]??=new Map);
w.__$k_data=(id,p,...a)=>{
  m.set(id,p);
  if(a.length){const s=(w["${STREAMED_DATA_DESCENDANTS}"]??=new Set);for(const x of a)s.add(x);}
  w.dispatchEvent(new CustomEvent(e,{detail:{id,...p}}));
  d.currentScript.remove();
};
d.currentScript.remove();
</script>
`.replace(/\r?\n/g, "")

function withStreamRenderMode<T>(fn: () => T): T {
  const prev = renderMode.current
  renderMode.current = "stream"
  try {
    return fn()
  } finally {
    renderMode.current = prev
  }
}

export interface RenderToReadableStreamOptions {
  /**
   * Runs before the synchronous shell render. Use to flush a precomputed
   * document prefix (static page head) while the shell is still rendering.
   */
  onStreamStart?: (
    controller: ReadableStreamDefaultController<string>
  ) => void | Promise<void>
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

  const speculativeByRoot = new Map<
    Kiru.StatefulPromise<unknown>,
    Promise<string[]>
  >()

  const onStreamData: HeadlessRenderContext["onStreamData"] = (data) => {
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

      const writePromise = Promise.all([
        promise
          .then(() => ({ data: promise.value }))
          .catch(() => ({ error: promise.error?.message })),
        speculativeByRoot.get(promise) ?? Promise.resolve([] as string[]),
      ]).then(async ([payload, descendants]) => {
        const dataArg = JSON.stringify(payload)
        const descendantArgs = descendants
          .map((id) => JSON.stringify(id))
          .join(",")
        // Hold each data-script enqueue until the shell is flushed,
        // even if `onShellReady` is async. Without this, a fast-
        // resolving promise could race ahead of the shell.
        await shellFlushed
        controller.enqueue(
          `<script type="text/javascript">__$k_data("${promise.id}",${dataArg}${
            descendantArgs ? `,${descendantArgs}` : ""
          })</script>`
        )
      })

      pendingWritePromises.push(writePromise)
    }
  }

  let speculativeChain: Promise<void> = Promise.resolve()

  const scheduleSpeculativeContinue: HeadlessRenderContext["scheduleSpeculativeContinue"] =
    (pending, continueRender, anchorVNode) => {
      const descendants: string[] = []
      const trackDescendantStreamData: HeadlessRenderContext["onStreamData"] = (
        data
      ) => {
        onStreamData(data)
        for (const child of data) {
          if (!descendants.includes(child.id)) {
            descendants.push(child.id)
          }
        }
      }

      const specPromise: Promise<string[]> = Promise.all(pending)
        .then(() => {
          withStreamRenderMode(() =>
            withSpeculativeStreamPromiseCollector(
              (child) => {
                if (!descendants.includes(child.id)) {
                  descendants.push(child.id)
                }
              },
              () =>
                speculativeTraverse(
                  { ...speculativeCtx, onStreamData: trackDescendantStreamData },
                  continueRender(),
                  anchorVNode,
                  0
                )
            )
          )
          return descendants
        })
        .catch(() => [])

      for (const p of pending) {
        speculativeByRoot.set(p, specPromise)
      }

      speculativeChain = speculativeChain.then(() => specPromise).then(() => {})
    }

  const ctx: HeadlessRenderContext = {
    write: (chunk) => {
      shellBuffer += chunk
    },
    onStreamData,
    scheduleSpeculativeContinue,
  }

  const speculativeCtx: SpeculativeTraverseContext = {
    onStreamData,
    scheduleSpeculativeContinue,
  }

  void (async () => {
    try {
      if (options?.onStreamStart) {
        await options.onStreamStart(controller)
      }
    } catch (error) {
      controller.error(error)
      return
    }
  })()

  withStreamRenderMode(() => headlessRender(ctx, rootNode))

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
      await speculativeChain
      await Promise.all(pendingWritePromises)
      controller.close()
    } catch (error) {
      controller.error(error)
    }
  })()

  return stream
}

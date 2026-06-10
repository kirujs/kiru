import { Fragment } from "../element.js"
import { renderMode } from "../globals.js"
import { STREAMED_DATA_DESCENDANTS, STREAMED_DATA_EVENT } from "../constants.js"
import { withSpeculativeStreamPromiseCollector } from "../resource.js"
import { runWithSsrRequestContext } from "../remote/action.js"
import type { CustomRequestContext } from "../router/types.js"
import {
  headlessRender,
  speculativeTraverse,
  HeadlessRenderContext,
  SpeculativeTraverseContext,
} from "../headlessRender.js"
import {
  buildStreamPayloadForInjection,
  setQueryInjectionStreamEmitter,
} from "./queryInjection.js"
import { setStreamPageDataEmitter } from "../router/pageData.js"

const STREAMED_DATA_SETUP = `
<script type="text/javascript">
const e="${STREAMED_DATA_EVENT}",d=document,w=window,m=(w[e]??=new Map);
w.__$k_data=(id,p,...a)=>{
  m.set(id,p);
  const s=(w["${STREAMED_DATA_DESCENDANTS}"]??=new Set);
  s.add(id);
  if(a.length){for(const x of a)s.add(x);}
  w.dispatchEvent(new CustomEvent(e,{detail:{id,...p}}));
  d.currentScript.remove();
};
d.currentScript.remove();
</script>
`.replace(/\r?\n/g, "")

/** `Promise.try` is not available on all supported Node versions. */
const promiseTry = <T,>(fn: () => T | PromiseLike<T>): Promise<T> =>
  Promise.resolve().then(fn)

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
  /** When set, nested speculative stream renders run remote actions with this context. */
  requestContext?: CustomRequestContext
  renderSignal?: AbortSignal
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
   * settle. When the shell contained streamed resources, `streamedDataSetup`
   * holds the `__$k_data` bootstrap script (injected outside `#app` by the
   * caller — it must not live in the shell body or hydration will mismatch).
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
    controller: ReadableStreamDefaultController<string>,
    extras?: { streamedDataSetup?: string }
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
  let streamedDataSetup = ""

  // Buffer sync shell writes so the caller can transform / wrap the whole
  // shell in `onShellReady` instead of intercepting individual chunks.
  let shellBuffer = ""
  let resolveShellFlushed!: () => void
  const shellFlushed = new Promise<void>((r) => {
    resolveShellFlushed = r
  })

  const enqueueTailScript = (script: string) => {
    void shellFlushed.then(() => {
      controller.enqueue(script)
    })
  }

  setQueryInjectionStreamEmitter(enqueueTailScript)
  setStreamPageDataEmitter(enqueueTailScript)

  const speculativeByRoot = new Map<
    Kiru.StatefulPromise<unknown>,
    Promise<string[]>
  >()

  const onStreamData: HeadlessRenderContext["onStreamData"] = (data) => {
    if (!streamedDataSetup) {
      // The setup script primes `window.__$k_data`. It must execute before
      // tail callsites but stay outside the app shell so client VDOM matches.
      streamedDataSetup = STREAMED_DATA_SETUP
    }
    for (const promise of data) {
      if (streamPromises.has(promise)) continue
      streamPromises.add(promise)

      const writePromise = Promise.all([
        promise
          .then(() =>
            buildStreamPayloadForInjection(
              promise as Kiru.StatefulPromise<unknown>
            )
          )
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
          const runSpeculative = () =>
            withStreamRenderMode(() =>
              withSpeculativeStreamPromiseCollector(
                (child) => {
                  if (!descendants.includes(child.id)) {
                    descendants.push(child.id)
                  }
                },
                () =>
                  speculativeTraverse(
                    {
                      ...speculativeCtx,
                      onStreamData: trackDescendantStreamData,
                    },
                    continueRender(),
                    anchorVNode,
                    0
                  )
              )
            )
          if (options?.requestContext && options?.renderSignal) {
            runWithSsrRequestContext(
              options.requestContext,
              options.renderSignal,
              runSpeculative
            )
          } else {
            runSpeculative()
          }
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

  promiseTry(() => options?.onStreamStart?.(controller)).catch((error) => {
    controller.error(error)
  })

  const runShellRender = () => headlessRender(ctx, rootNode)
  if (options?.requestContext && options?.renderSignal) {
    runWithSsrRequestContext(
      options.requestContext,
      options.renderSignal,
      () => withStreamRenderMode(runShellRender)
    )
  } else {
    withStreamRenderMode(runShellRender)
  }

  void promiseTry(async () => {
    try {
      const shellExtras = streamedDataSetup
        ? { streamedDataSetup }
        : undefined
      if (options?.onShellReady) {
        await options.onShellReady(shellBuffer, controller, shellExtras)
      } else {
        controller.enqueue(shellBuffer)
        if (streamedDataSetup) {
          controller.enqueue(streamedDataSetup)
        }
      }
    } finally {
      resolveShellFlushed()
    }
    await speculativeChain
    await Promise.all(pendingWritePromises)
    setQueryInjectionStreamEmitter(null)
    setStreamPageDataEmitter(null)
    controller.close()
  }).catch((error) => {
    setQueryInjectionStreamEmitter(null)
    setStreamPageDataEmitter(null)
    controller.error(error)
  })

  return stream
}

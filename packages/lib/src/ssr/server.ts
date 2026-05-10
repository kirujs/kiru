import { Fragment } from "../element.js"
import { renderMode } from "../globals.js"
import { STREAMED_DATA_EVENT } from "../constants.js"
import { headlessRender, HeadlessRenderContext } from "../headlessRender.js"

/** Inline after each `k-data` script so hydration resolves before stream closes. */
function perChunkHydrationBoot(promiseId: string): string {
  const ev = STREAMED_DATA_EVENT
  return `<script type="text/javascript">(function(){var s=document.getElementById(${JSON.stringify(
    promiseId
  )});if(!s)return;var m=(window[${JSON.stringify(
    ev
  )}]??=new Map());try{var j=JSON.parse(s.textContent||"null");m.set(${JSON.stringify(
    promiseId
  )},{data:j.data,error:j.error});window.dispatchEvent(new CustomEvent(${JSON.stringify(
    ev
  )},{detail:{id:${JSON.stringify(promiseId)},data:j.data,error:j.error}}));}catch(e){m.set(${JSON.stringify(
    promiseId
  )},{data:void 0,error:String(e)});}s.remove();document.currentScript.remove();})();</script>`
}

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

  const ctx: HeadlessRenderContext = {
    write: (chunk) => controller.enqueue(chunk),
    onStreamData(data) {
      for (const promise of data) {
        if (streamPromises.has(promise)) continue
        streamPromises.add(promise)

        const writePromise = promise
          .then(() => ({ data: promise.value }))
          .catch(() => ({ error: promise.error?.message }))
          .then((value) => {
            const content = JSON.stringify(value)
            const id = promise.id
            controller.enqueue(
              `<script id="${id}" k-data type="application/json">${content}</script>`
            )
            controller.enqueue(perChunkHydrationBoot(id))
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
      controller.close()
    })
  } else {
    controller.close()
  }

  return stream
}

import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  createRenderer,
  createRoute,
  createRouteTree,
  serverLoader,
} from "../../router/index.js"
const MINIMAL_TPL =
  "<!doctype html><html><head>{{kiru_head}}</head><body>{{kiru_body}}</body></html>"

function delayUntilAborted(signal: AbortSignal, ms: number): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("Aborted", "AbortError"))
      return
    }
    const timer = setTimeout(resolve, ms)
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer)
        reject(new DOMException("Aborted", "AbortError"))
      },
      { once: true }
    )
  })
}

describe("SSR request abort", () => {
  it("returns null when the request aborts during a slow serverLoader", async () => {
    const load = serverLoader(async (ctx) => {
      await delayUntilAborted(ctx.signal, 500)
      return { label: "done" }
    })
    const routes = createRouteTree({
        children: [
          createRoute("/slow", {
            component: async () => ({
              load,
              default: () => null,
            }),
          }),
        ],
      })
    const renderer = createRenderer({
      routes,
      htmlTemplate: MINIMAL_TPL,
    })

    const ctrl = new AbortController()
    const request = new Request("http://localhost/slow", {
      signal: ctrl.signal,
    })
    const renderPromise = renderer.render(request)

    await new Promise((r) => setTimeout(r, 10))
    ctrl.abort()

    const result = await renderPromise
    assert.equal(result, null)
  })

  it("returns null when the request is already aborted", async () => {
    const load = serverLoader(async () => ({ ok: true }))
    const routes = createRouteTree({
        children: [
          createRoute("/", {
            component: async () => ({
              load,
              default: () => null,
            }),
          }),
        ],
      })
    const renderer = createRenderer({
      routes,
      htmlTemplate: MINIMAL_TPL,
    })

    const ctrl = new AbortController()
    ctrl.abort()
    const request = new Request("http://localhost/", {
      signal: ctrl.signal,
    })

    const result = await renderer.render(request)
    assert.equal(result, null)
  })
})

import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  STATIC_LOADER_PAYLOAD_EXPORT,
  buildStaticLoaderLookupKey,
  emitStaticLoaderPrerenderCapture,
  onStaticLoaderPrerenderCapture,
  readPageStaticLoaderPayload,
  resolveStaticLoaderDataFromModule,
} from "../../router/staticLoaderData.js"
import { buildLoaderContext } from "../../router/runPageLoad.js"

describe("staticLoaderData", () => {
  it("onStaticLoaderPrerenderCapture receives prerender events", () => {
    const captures: Array<{ routeId: string; pathname: string }> = []
    const off = onStaticLoaderPrerenderCapture((capture) => {
      captures.push({ routeId: capture.routeId, pathname: capture.pathname })
    })
    emitStaticLoaderPrerenderCapture({
      routeId: "route:1",
      pathname: "/loaders/static",
      pageData: { ok: true },
    })
    off()
    assert.deepEqual(captures, [
      { routeId: "route:1", pathname: "/loaders/static" },
    ])
  })

  it("resolveStaticLoaderDataFromModule reads per-module payload export", () => {
    const mod = {
      [STATIC_LOADER_PAYLOAD_EXPORT]: {
        "/about": { title: "About" },
      },
    }
    const ctx = buildLoaderContext({
      meta: {},
      routeId: "route:1",
      params: {},
      pathname: "/about",
      search: "",
      hash: "",
      query: {},
      context: {},
    })
    assert.deepEqual(resolveStaticLoaderDataFromModule(mod, ctx), {
      title: "About",
    })
    assert.equal(buildStaticLoaderLookupKey(ctx), "/about")
    assert.deepEqual(readPageStaticLoaderPayload(mod), {
      "/about": { title: "About" },
    })
  })
})

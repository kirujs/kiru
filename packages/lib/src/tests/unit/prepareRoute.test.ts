import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { createElement } from "../../index.js"
import { buildLoaderContext } from "../../router/runPageLoad.js"
import { prepareRouteForNavigation } from "../../router/prepareRoute.js"
import { serverLoader } from "../../router/loaders.js"

describe("prepareRouteForNavigation", () => {
  it("skips load gate when forceReload is set for serverLoader + fallback", async () => {
    const load = serverLoader({
      load: async () => ({ ok: true }),
      fallback: () => createElement("p", null, "loading"),
    })
    const pageMod = {
      load,
      default: () => createElement("p", null, "page"),
    }
    const loaderCtx = buildLoaderContext({
      params: {},
      pathname: "/",
      search: "",
      hash: "",
      query: {},
      context: {},
    })
    const prepared = await prepareRouteForNavigation({
      pageMod,
      routeModule: { default: () => createElement("p", null, "page") },
      loaderCtx,
      options: { forceReload: true, useHydratedPageData: false },
    })
    assert.equal(prepared.usesLoadGate, false)
    assert.deepEqual(prepared.leafProps, { data: { ok: true }, error: null })
  })
})

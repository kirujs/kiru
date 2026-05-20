import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { loader, serverLoader } from "../../router/loaders.js"
import { resolveSsrRouteModule } from "../../router/prepareRoute.js"
import { staticLoaderSignal } from "../../router/navigationScope.js"
import { buildLoaderContext } from "../../router/runPageLoad.js"

describe("resolveSsrRouteModule", () => {
  it("wraps route module with load gate when streaming load is enabled", async () => {
    const load = serverLoader({
      load: async () => ({ ok: true }),
      fallback: () => null as unknown as JSX.Element,
    })
    const pageMod = { load }
    const routeModule = { default: () => null }
    const loaderCtx = buildLoaderContext({
      params: {},
      pathname: "/",
      search: "",
      hash: "",
      query: {},
      context: {},
      routeId: "home",
      signal: staticLoaderSignal(),
    })
    const result = await resolveSsrRouteModule({
      pageMod,
      routeModule,
      loaderCtx,
      enableStreamingLoad: true,
      routeId: "home",
    })
    assert.equal(result.streamPageLoad, true)
    assert.deepEqual(result.pageProps, {})
    assert.notEqual(result.routeModule, routeModule)
  })

  it("resolves page props when not streaming", async () => {
    const load = loader({ load: async () => ({ n: 1 }) })
    const pageMod = { load }
    const routeModule = { default: () => null }
    const loaderCtx = buildLoaderContext({
      params: {},
      pathname: "/",
      search: "",
      hash: "",
      query: {},
      context: {},
      routeId: "home",
      signal: staticLoaderSignal(),
    })
    const result = await resolveSsrRouteModule({
      pageMod,
      routeModule,
      loaderCtx,
      enableStreamingLoad: false,
      routeId: "home",
    })
    assert.equal(result.streamPageLoad, false)
    assert.equal((result.pageProps as { data: { n: number } }).data.n, 1)
  })
})

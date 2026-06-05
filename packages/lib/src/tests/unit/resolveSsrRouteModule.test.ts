import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { loader, serverLoader } from "../../router/loaders.js"
import { defineHeadContent } from "../../router/pageHead.js"
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

  it("streams when dynamic sync head only uses params", async () => {
    const load = serverLoader({
      load: async () => ({ ok: true }),
      fallback: () => null as unknown as JSX.Element,
    })
    const pageMod = {
      load,
      head: defineHeadContent((ctx) => ({
        title: `Item ${ctx.params.id}`,
      })),
    }
    const routeModule = { default: () => null }
    const loaderCtx = buildLoaderContext({
      params: { id: "7" },
      pathname: "/items/7",
      search: "",
      hash: "",
      query: {},
      context: {},
      routeId: "items",
      signal: staticLoaderSignal(),
    })
    const result = await resolveSsrRouteModule({
      pageMod,
      routeModule,
      loaderCtx,
      enableStreamingLoad: true,
      routeId: "items",
    })
    assert.equal(result.streamPageLoad, true)
  })

  it("does not stream when dynamic head returns a Promise", async () => {
    const load = serverLoader({
      load: async () => ({ title: "Gizmo" }),
      fallback: () => null as unknown as JSX.Element,
    })
    const pageMod = {
      load,
      head: defineHeadContent<typeof load>(async (ctx) => {
        const { data } = await ctx.loader()
        return { title: `Product: ${data!.title}` }
      }),
    }
    const routeModule = { default: () => null }
    const loaderCtx = buildLoaderContext({
      params: {},
      pathname: "/product",
      search: "",
      hash: "",
      query: {},
      context: {},
      routeId: "product",
      signal: staticLoaderSignal(),
    })
    const result = await resolveSsrRouteModule({
      pageMod,
      routeModule,
      loaderCtx,
      enableStreamingLoad: true,
      routeId: "product",
    })
    assert.equal(result.streamPageLoad, false)
    assert.equal((result.pageProps as { data: { title: string } }).data.title, "Gizmo")
  })
})

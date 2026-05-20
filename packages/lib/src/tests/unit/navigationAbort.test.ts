import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { compileRouteTree, createRouter, defineRouteTree } from "../../router/index.js"
import {
  buildLoaderCacheKey,
  clearLoaderCacheForTests,
  getLoaderCacheEntry,
} from "../../router/loaderCache.js"
import { loader } from "../../router/loaders.js"
import { resetHydratedPageData } from "../../router/pageData.js"
import {
  buildScopeCacheKey,
  createNavigationScope,
} from "../../router/navigationScope.js"
import { prepareRouteForNavigation } from "../../router/prepareRoute.js"
import { getRouterRuntime } from "../../router/routerRuntime.js"
import { buildLoaderContext, resolvePagePropsFromModule } from "../../router/runPageLoad.js"
import { staticLoaderSignal } from "../../router/navigationScope.js"

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

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

describe("navigation abort integration", () => {
  it("aborts the prior navigation signal when navigate is called again", async () => {
    const routes = defineRouteTree((r) =>
      r.scope({
        children: [
          r.page("/page-a", async () => ({ default: () => null })),
          r.page("/page-b", async () => ({ default: () => null })),
        ],
      })
    )
    const manifest = compileRouteTree(routes)
    const history = {
      pushState() {},
      replaceState() {},
    } as any as History
    const location = {
      pathname: "/",
      search: "",
      hash: "",
      origin: "http://localhost",
    } as any as Location

    const router = createRouter({ routes: manifest, history, location })

    const navA = router.navigate("/page-a")
    await new Promise<void>((r) => queueMicrotask(r))
    const { getNavSignal, getNavGeneration } = getRouterRuntime(router)
    const firstSignal = getNavSignal()

    const navB = router.navigate("/page-b")
    const secondSignal = getNavSignal()

    assert.notEqual(firstSignal, secondSignal)
    assert.equal(firstSignal.aborted, true)
    assert.equal(secondSignal.aborted, false)

    await Promise.all([navA, navB])

    assert.equal(router.pathname.value, "/page-b")
    assert.equal(getNavGeneration(), 2)
  })

  it("discards a slow loader when navigation generation advances mid-flight", async () => {
    const prevDocument = globalThis.document
    // @ts-expect-error test shim
    globalThis.document = {}

    try {
      clearLoaderCacheForTests()
      let generation = 1
      const routeId = "route:slow"
      const cacheKey = buildScopeCacheKey(routeId, "/slow", "")
      const scope = createNavigationScope(
        generation,
        staticLoaderSignal(),
        cacheKey
      )

      const mod = {
        load: loader(async () => {
          await delay(40)
          return { page: "slow" }
        }),
      }
      const ctx = buildLoaderContext({
        params: {},
        pathname: "/slow",
        search: "",
        hash: "",
        query: {},
        context: {},
        routeId,
        signal: scope.signal,
      })

      const resultPromise = resolvePagePropsFromModule(mod, ctx, {
        routeId,
        useHydratedPageData: false,
        scope,
        getNavGeneration: () => generation,
      })

      generation = 2
      const result = await resultPromise

      assert.equal(result.discarded, true)
      const loaderKey = buildLoaderCacheKey(routeId, "/slow", "")
      assert.equal(getLoaderCacheEntry(loaderKey), undefined)
    } finally {
      globalThis.document = prevDocument
      resetHydratedPageData()
      clearLoaderCacheForTests()
    }
  })

  it("prepareRouteForNavigation returns discarded when scope is stale after slow load", async () => {
    let generation = 1
    const ctrl = new AbortController()
    const routeId = "route:prep"
    const scope = createNavigationScope(
      generation,
      ctrl.signal,
      buildScopeCacheKey(routeId, "/prep", "")
    )

    const pageMod = {
      load: loader(async (ctx) => {
        await delayUntilAborted(ctx.signal, 80)
        return { ok: true }
      }),
      default: () => null,
    }

    const loaderCtx = buildLoaderContext({
      params: {},
      pathname: "/prep",
      search: "",
      hash: "",
      query: {},
      context: {},
      routeId,
      signal: scope.signal,
    })

    const preparedPromise = prepareRouteForNavigation({
      pageMod,
      routeModule: { default: () => null },
      loaderCtx,
      options: {
        useHydratedPageData: false,
        routeId,
        scope,
        getNavGeneration: () => generation,
      },
    })

    generation = 2
    const prepared = await preparedPromise

    assert.equal(prepared.discarded, true)
    assert.deepEqual(prepared.leafProps, {})
  })
})

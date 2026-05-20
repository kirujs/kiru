import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  buildLoaderCacheKey,
  clearLoaderCacheForTests,
  setLoaderCacheEntry,
} from "../../router/loaderCache.js"
import { loader } from "../../router/loaders.js"
import { resetHydratedPageData } from "../../router/pageData.js"
import { resolvePagePropsFromModule } from "../../router/runPageLoad.js"
import {
  buildScopeCacheKey,
  createNavigationScope,
  staticLoaderSignal,
} from "../../router/navigationScope.js"

describe("loader stale while revalidate", () => {
  it("returns stale cached props and refreshes in background", async () => {
    const prevDocument = globalThis.document
    // @ts-expect-error test shim
    globalThis.document = {}

    try {
      clearLoaderCacheForTests()
      let invokeCount = 0
      const mod = {
        load: loader(async () => {
          invokeCount += 1
          return { value: invokeCount }
        }),
      }

      const ctx = {
        params: {},
        url: { pathname: "/items", search: "", hash: "" },
        query: {},
        context: {},
        meta: {},
        route: { id: "route:1" },
        signal: staticLoaderSignal(),
      }

      const key = buildLoaderCacheKey("route:1", "/items", "")
      setLoaderCacheEntry(key, {
        data: { value: 1 },
        fetchedAt: Date.now() - 10_000,
        staleTime: 1,
        gcTime: 60_000,
      })

      let refreshed = false
      const scope = createNavigationScope(
        1,
        new AbortController().signal,
        buildScopeCacheKey("route:1", "/items", "")
      )
      const first = await resolvePagePropsFromModule(mod, ctx, {
        routeId: "route:1",
        useHydratedPageData: false,
        scope,
        getNavGeneration: () => 1,
        onCacheRefreshed: () => {
          refreshed = true
        },
      })

      assert.equal(first.isStale, true)
      assert.deepEqual((first.props as { data: { value: number } }).data, {
        value: 1,
      })

      await new Promise((r) => setTimeout(r, 20))
      assert.equal(refreshed, true)
      assert.equal(invokeCount, 1)

      refreshed = false
      const staleScope = createNavigationScope(
        0,
        new AbortController().signal,
        buildScopeCacheKey("route:1", "/items", "")
      )
      await resolvePagePropsFromModule(mod, ctx, {
        routeId: "route:1",
        useHydratedPageData: false,
        scope: staleScope,
        getNavGeneration: () => 1,
        onCacheRefreshed: () => {
          refreshed = true
        },
      })
      await new Promise((r) => setTimeout(r, 20))
      assert.equal(refreshed, false)
    } finally {
      globalThis.document = prevDocument
      resetHydratedPageData()
      clearLoaderCacheForTests()
    }
  })
})

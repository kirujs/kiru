import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  buildLoaderCacheKey,
  clearLoaderCacheForTests,
  getLoaderCacheEntry,
  invalidateLoaderCache,
  isLoaderCacheStale,
  setLoaderCacheEntry,
} from "../../router/loaderCache.js"
import { loader } from "../../router/loaders.js"
import { resetHydratedPageData } from "../../router/pageData.js"
import { resolvePagePropsFromModule } from "../../router/runPageLoad.js"
import { staticLoaderSignal } from "../../router/navigationScope.js"

describe("loaderCache", () => {
  it("stores and retrieves fresh entries", () => {
    clearLoaderCacheForTests()
    const key = buildLoaderCacheKey("route:1", "/items", "")
    setLoaderCacheEntry(key, {
      data: { n: 1 },
      fetchedAt: Date.now(),
      staleTime: 60_000,
      gcTime: 120_000,
    })
    const entry = getLoaderCacheEntry(key)
    assert.equal((entry?.data as { n: number }).n, 1)
    assert.equal(isLoaderCacheStale(entry!), false)
  })

  it("invalidateLoaderCache by routeIds", () => {
    clearLoaderCacheForTests()
    setLoaderCacheEntry(buildLoaderCacheKey("route:1", "/", ""), {
      data: 1,
      fetchedAt: Date.now(),
      staleTime: 0,
      gcTime: 60_000,
    })
    setLoaderCacheEntry(buildLoaderCacheKey("route:2", "/", ""), {
      data: 2,
      fetchedAt: Date.now(),
      staleTime: 0,
      gcTime: 60_000,
    })
    invalidateLoaderCache({ routeIds: ["route:1"] })
    assert.equal(getLoaderCacheEntry(buildLoaderCacheKey("route:1", "/", "")), undefined)
    assert.ok(getLoaderCacheEntry(buildLoaderCacheKey("route:2", "/", "")))
  })

  it("seeds loader cache from k-page-data for universal loader on hydrate", async () => {
    const prevDocument = globalThis.document
    clearLoaderCacheForTests()
    resetHydratedPageData()
    // @ts-expect-error test shim
    globalThis.document = {
      querySelector(sel: string) {
        if (sel !== "script[k-page-data]") return null
        return {
          textContent: JSON.stringify({ count: 1 }),
          remove() {},
        }
      },
    }

    try {
      let invokes = 0
      const mod = {
        load: loader(async () => {
          invokes += 1
          return { count: invokes }
        }),
      }
      const ctx = {
        params: {},
        url: { pathname: "/loader-cache-demo", search: "", hash: "" },
        query: {},
        context: {},
        meta: {},
        route: { id: "route:loader-cache" },
        signal: staticLoaderSignal(),
      }
      const routeId = "route:loader-cache"

      await resolvePagePropsFromModule(mod, ctx, {
        useHydratedPageData: true,
        routeId,
      })
      assert.equal(invokes, 0)

      const cached = await resolvePagePropsFromModule(mod, ctx, {
        useHydratedPageData: false,
        routeId,
      })
      assert.deepEqual(
        (cached.props as { data: { count: number } }).data,
        { count: 1 }
      )
      assert.equal(invokes, 0)
    } finally {
      globalThis.document = prevDocument
      clearLoaderCacheForTests()
      resetHydratedPageData()
    }
  })
})

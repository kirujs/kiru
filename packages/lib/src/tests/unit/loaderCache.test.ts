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
})

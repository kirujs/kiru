import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  buildScopeCacheKey,
  canCommitLoaderResult,
  createNavigationScope,
  isScopeCurrent,
  staticLoaderSignal,
} from "../../router/navigationScope.js"
import {
  buildLoaderCacheKey,
  clearLoaderCacheForTests,
  getLoaderCacheEntry,
} from "../../router/loaderCache.js"
import { loader } from "../../router/loaders.js"
import { resetHydratedPageData } from "../../router/pageData.js"
import { buildLoaderContext, resolvePagePropsFromModule } from "../../router/runPageLoad.js"

describe("navigationScope", () => {
  it("isScopeCurrent is false when generation or signal changes", () => {
    const ctrl = new AbortController()
    const scope = createNavigationScope(1, ctrl.signal)
    assert.equal(isScopeCurrent(scope, () => 1), true)
    assert.equal(isScopeCurrent(scope, () => 2), false)
    ctrl.abort()
    assert.equal(isScopeCurrent(scope, () => 1), false)
  })

  it("canCommitLoaderResult requires matching cacheKey", () => {
    const scope = createNavigationScope(
      1,
      new AbortController().signal,
      buildScopeCacheKey("r1", "/a", "")
    )
    assert.equal(
      canCommitLoaderResult(scope, () => 1, buildScopeCacheKey("r1", "/a", "")),
      true
    )
    assert.equal(
      canCommitLoaderResult(scope, () => 1, buildScopeCacheKey("r1", "/b", "")),
      false
    )
  })
})

describe("resolvePagePropsFromModule scope gates", () => {
  it("skips cache write when scope is stale after load", async () => {
    const prevDocument = globalThis.document
    // @ts-expect-error test shim
    globalThis.document = {}

    try {
      clearLoaderCacheForTests()
      const mod = {
        load: loader(async () => ({ ok: true })),
      }
      const ctx = buildLoaderContext({
        params: {},
        pathname: "/x",
        search: "",
        hash: "",
        query: {},
        context: {},
        routeId: "route:1",
        signal: staticLoaderSignal(),
      })
      const ctrl = new AbortController()
      const scope = createNavigationScope(
        1,
        ctrl.signal,
        buildScopeCacheKey("route:1", "/x", "")
      )
      const result = await resolvePagePropsFromModule(mod, ctx, {
        routeId: "route:1",
        useHydratedPageData: false,
        scope,
        getNavGeneration: () => 2,
      })
      assert.equal(result.discarded, true)
      const key = buildLoaderCacheKey("route:1", "/x", "")
      assert.equal(getLoaderCacheEntry(key), undefined)
    } finally {
      globalThis.document = prevDocument
      resetHydratedPageData()
      clearLoaderCacheForTests()
    }
  })
})

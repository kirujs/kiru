import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { ensureLoaderClient, getLoaderDispatch } from "../../router/loaderClient.js"
import { ensureKiruLazyRuntime, ensureKiruRouterRuntime } from "../../kiruRuntime.js"
import { withJSDOM } from "./jsdom.js"

describe("window.__kiru runtime bags", () => {
  it("initializes router.loaders without clobbering apps", async () => {
    await withJSDOM(async () => {
      const router = ensureKiruRouterRuntime()
      assert.equal(router.loaders, undefined)
      ensureLoaderClient()
      assert.equal(typeof router.loaders!.dispatch, "function")
      assert.equal(typeof getLoaderDispatch(), "function")
      assert.ok(window.__kiru.apps)
    })
  })

  it("initializes lazy.cache without clobbering apps", async () => {
    await withJSDOM(async () => {
      const lazy = ensureKiruLazyRuntime()
      assert.ok(lazy.cache instanceof Map)
      assert.equal(lazy.cache.size, 0)
      assert.ok(window.__kiru.apps)
    })
  })
})

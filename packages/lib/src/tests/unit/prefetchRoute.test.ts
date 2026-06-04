import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { ensureLoaderClient } from "../../router/loaderClient.js"
import { resolveLinkPrefetch } from "../../router/prefetchRoute.js"
import { withJSDOM } from "./jsdom.js"

describe("resolveLinkPrefetch", () => {
  it("returns false when prefetch is disabled", () => {
    assert.equal(resolveLinkPrefetch(false), false)
  })

  it("merges defaults for object prefetch", async () => {
    await withJSDOM(async () => {
      const resolved = resolveLinkPrefetch({ trigger: "visible" })
      assert.notEqual(resolved, false)
      if (resolved !== false) {
        assert.equal(resolved.trigger, "visible")
        assert.equal(resolved.chunks, true)
        assert.equal(resolved.data, false)
      }
    })
  })

  it("merges data true when loader client is wired", async () => {
    await withJSDOM(async () => {
      ensureLoaderClient()
      const resolved = resolveLinkPrefetch({})
      assert.notEqual(resolved, false)
      if (resolved !== false) {
        assert.equal(resolved.data, true)
      }
    })
  })
})

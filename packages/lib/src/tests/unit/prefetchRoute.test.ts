import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { resolveLinkPrefetch } from "../../router/prefetchRoute.js"

describe("resolveLinkPrefetch", () => {
  it("returns false when prefetch is disabled", () => {
    assert.equal(resolveLinkPrefetch(false), false)
  })

  it("merges defaults for object prefetch", () => {
    const resolved = resolveLinkPrefetch({ trigger: "visible" })
    assert.notEqual(resolved, false)
    if (resolved !== false) {
      assert.equal(resolved.trigger, "visible")
      assert.equal(resolved.chunks, true)
    }
  })
})

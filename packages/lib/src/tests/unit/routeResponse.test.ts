import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  cachePolicyToHeaders,
  mergeResponseHeaders,
} from "../../router/routeResponse.js"

describe("routeResponse", () => {
  it("mergeResponseHeaders lowercases keys", () => {
    const h = mergeResponseHeaders(
      { "X-Custom": "1" },
      { "Cache-Control": "no-store" }
    )
    assert.equal(h["x-custom"], "1")
    assert.equal(h["cache-control"], "no-store")
  })

  it("cachePolicyToHeaders for static routes", () => {
    const h = cachePolicyToHeaders(undefined, true)
    assert.match(h["cache-control"], /immutable/)
  })

  it("cachePolicyToHeaders immutable when revalidate is false", () => {
    const h = cachePolicyToHeaders(undefined, false, false)
    assert.match(h["cache-control"], /immutable/)
  })
})

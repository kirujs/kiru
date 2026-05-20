import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  cachePolicyToHeaders,
  mergeResponseHeaders,
  resolveRouteStatus,
} from "../../router/routeResponse.js"
import { buildLoaderContext } from "../../router/runPageLoad.js"
import { staticLoaderSignal } from "../../router/navigationScope.js"

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

  it("resolveRouteStatus from number export", () => {
    const ctx = buildLoaderContext({
      params: {},
      pathname: "/",
      search: "",
      hash: "",
      query: {},
      context: {},
      meta: {},
      routeId: "route:1",
      signal: staticLoaderSignal(),
    })
    assert.equal(resolveRouteStatus(404, ctx), 404)
  })
})

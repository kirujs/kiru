import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  assertLoaderRpcBodyShape,
  assertTokenWithinLimits,
  checkUrlWithinLimits,
  DEFAULT_REQUEST_LIMITS,
  parseQueryBounded,
  readBoundedJson,
  RequestLimitError,
  resolveRequestLimits,
  validateRouteParams,
} from "../../router/requestLimits.js"

describe("requestLimits", () => {
  it("checkUrlWithinLimits rejects long pathname with 414", () => {
    const path = "/" + "a".repeat(DEFAULT_REQUEST_LIMITS.maxPathnameLength)
    const v = checkUrlWithinLimits(path, "")
    assert.ok(v)
    assert.equal(v!.status, 414)
  })

  it("checkUrlWithinLimits rejects long search with 400", () => {
    const search =
      "?" + "q".repeat(DEFAULT_REQUEST_LIMITS.maxSearchLength + 1)
    const v = checkUrlWithinLimits("/", search)
    assert.ok(v)
    assert.equal(v!.status, 400)
  })

  it("parseQueryBounded rejects too many keys", () => {
    const params = new URLSearchParams()
    for (let i = 0; i <= DEFAULT_REQUEST_LIMITS.maxQueryKeys; i++) {
      params.set(`k${i}`, "1")
    }
    assert.throws(
      () => parseQueryBounded(`?${params.toString()}`),
      (e) => e instanceof RequestLimitError && e.status === 400
    )
  })

  it("validateRouteParams rejects oversize param values", () => {
    assert.equal(
      validateRouteParams(
        { id: "x".repeat(DEFAULT_REQUEST_LIMITS.maxRouteParamLength + 1) },
        DEFAULT_REQUEST_LIMITS
      ),
      false
    )
  })

  it("validateRouteParams rejects too many catch-all segments", () => {
    const segments = Array.from(
      { length: DEFAULT_REQUEST_LIMITS.maxRouteParamSegments + 1 },
      (_, i) => `s${i}`
    ).join("/")
    assert.equal(validateRouteParams({ slug: segments }, DEFAULT_REQUEST_LIMITS), false)
  })

  it("assertLoaderRpcBodyShape rejects unknown top-level keys", () => {
    assert.throws(
      () =>
        assertLoaderRpcBodyShape({
          params: {},
          query: {},
          url: { pathname: "/", search: "", hash: "" },
          giantPayload: "x",
        }),
      RequestLimitError
    )
  })

  it("readBoundedJson returns 413 for oversized body", async () => {
    const big = JSON.stringify({ x: "y".repeat(2_000_000) })
    const req = new Request("http://localhost/", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: big,
    })
    await assert.rejects(
      () => readBoundedJson(req, 1024),
      (e) => e instanceof RequestLimitError && e.status === 413
    )
  })

  it("assertTokenWithinLimits rejects long tokens", () => {
    assert.throws(
      () =>
        assertTokenWithinLimits("x".repeat(DEFAULT_REQUEST_LIMITS.maxTokenLength + 1)),
      RequestLimitError
    )
  })

  it("resolveRequestLimits merges overrides", () => {
    const limits = resolveRequestLimits({ maxQueryKeys: 8 })
    assert.equal(limits.maxQueryKeys, 8)
    assert.equal(limits.maxPathnameLength, DEFAULT_REQUEST_LIMITS.maxPathnameLength)
  })
})

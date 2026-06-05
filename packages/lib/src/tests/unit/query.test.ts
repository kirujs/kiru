import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { buildQueryCacheKey, buildQueryWireRefId } from "../../remote/queryCache.js"
import { stableSerialize } from "../../remote/stableSerialize.js"
import { query } from "../../remote/query.js"

describe("query cache key", () => {
  it("stableSerialize sorts object keys", () => {
    assert.equal(
      stableSerialize({ b: 1, a: 2 }),
      stableSerialize({ a: 2, b: 1 })
    )
  })

  it("buildQueryCacheKey includes query id", () => {
    const key = buildQueryCacheKey("r:foo:get", "santa")
    assert.ok(key.startsWith("r:foo:get:"))
  })

  it("treats missing, null, and undefined optional fields as equivalent", () => {
    const queryId = "r:feed:get"
    const loaderKey = buildQueryCacheKey(queryId, { sort: "hot" })
    const resourceKey = buildQueryCacheKey(queryId, {
      sort: "hot",
      communitySlug: undefined,
    })
    const nullKey = buildQueryCacheKey(queryId, {
      sort: "hot",
      communitySlug: null,
    })
    assert.equal(loaderKey, resourceKey)
    assert.equal(loaderKey, nullKey)
    assert.equal(buildQueryWireRefId(loaderKey), buildQueryWireRefId(resourceKey))
  })

  it("buildQueryWireRefId hashes cache keys without embedding input", () => {
    const key = buildQueryCacheKey("r:foo:get", { items: "x".repeat(10_000) })
    const wireRef = buildQueryWireRefId(key)
    assert.match(wireRef, /^k:q:[A-Za-z0-9_-]+$/)
    assert.ok(wireRef.length < 32)
    assert.ok(!wireRef.includes("items"))
    assert.equal(buildQueryWireRefId(key), wireRef)
  })
})

describe("query factory", () => {
  it("void query exports set() and refresh() but not key()", () => {
    const q = query(async () => 1)
    assert.equal(typeof q.set, "function")
    assert.equal(typeof q.refresh, "function")
    assert.equal("key" in q, false)
    assert.equal(typeof q, "function")
    assert.equal(q.__kiruRemoteQuery, true)
    assert.equal(q.__kiruQueryVoid, true)
  })

  it("accepts schema and handler", () => {
    const idSchema = {
      parse: (input: unknown) => {
        if (typeof input !== "string") throw new Error("expected string")
        return input
      },
    }
    const q = query(idSchema, async (id) => id)
    assert.equal(q.__kiruRemoteQuery, true)
    assert.equal(q.__kiruQueryVoid, false)
  })

  it("key(input) shares cache key with call(input)", () => {
    const idSchema = {
      parse: (input: unknown) => {
        if (typeof input !== "string") throw new Error("expected string")
        return input
      },
    }
    const q = query(idSchema, async (id) => id)
    q.__kiruQueryId = "r:test:get"
    const a = q.key("santa")
    const b = q.key("santa")
    assert.equal(a.__kiruQueryId, b.__kiruQueryId)
    assert.equal(a.input, b.input)
    assert.equal(
      buildQueryCacheKey(a.__kiruQueryId ?? "", a.input),
      buildQueryCacheKey(b.__kiruQueryId ?? "", b.input)
    )
  })
})

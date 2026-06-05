import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { buildQueryCacheKey } from "../../remote/queryCache.js"
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

import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  buildQueryCacheKey,
  getQueryCacheEntry,
  setQueryCacheEntry,
} from "../../remote/queryCache.js"
import { buildRequestedFromTargets } from "../../remote/mutationResult.js"
import { query } from "../../remote/query.js"

const idSchema = {
  parse: (input: unknown) => {
    if (typeof input !== "string") throw new Error("expected string")
    return input
  },
}

describe("query.optimistic()", () => {
  it("void factory optimistic updates cache", () => {
    const listTodos = query(async () => [{ id: "1", text: "a" }])
    listTodos.__kiruQueryId = "r:test:listTodos"
    setQueryCacheEntry(buildQueryCacheKey("r:test:listTodos", null), [
      { id: "1", text: "a" },
    ])

    const override = listTodos.optimistic((current) => [
      ...(current ?? []),
      { id: "2", text: "b" },
    ])

    assert.equal(override.__kiruOptimisticOverride.length, 2)
    const key = buildQueryCacheKey("r:test:listTodos", null)
    assert.deepEqual(getQueryCacheEntry(key)?.data, [
      { id: "1", text: "a" },
      { id: "2", text: "b" },
    ])
  })

  it("keyed instance optimistic updates cache and wire payload", () => {
    const getPosts = query(idSchema, async (id: string) => [id])
    getPosts.__kiruQueryId = "r:test:getPosts"

    const override = getPosts.key("santa").optimistic(() => ["new", "santa"])
    const wire = buildRequestedFromTargets([override])
    assert.deepEqual(wire, [
      {
        queryId: "r:test:getPosts",
        input: "santa",
        optimistic: ["new", "santa"],
      },
    ])

    const key = buildQueryCacheKey("r:test:getPosts", "santa")
    assert.deepEqual(getQueryCacheEntry(key)?.data, ["new", "santa"])
  })

  it("void optimistic serializes on wire", () => {
    const listTodos = query(async () => [] as string[])
    listTodos.__kiruQueryId = "r:test:voidOpt"
    setQueryCacheEntry(buildQueryCacheKey("r:test:voidOpt", null), ["old"])

    const override = listTodos.optimistic((current) => [...(current ?? []), "new"])
    const wire = buildRequestedFromTargets([override])
    assert.deepEqual(wire, [
      {
        queryId: "r:test:voidOpt",
        input: null,
        optimistic: ["old", "new"],
      },
    ])
  })
})

import { describe, it } from "node:test"
import assert from "node:assert/strict"
import {
  attachQueriesToPayload,
  seedQueriesFromPayload,
} from "../../remote/pageDataQueries.js"
import { buildQueryCacheKey, getQueryCacheEntry } from "../../remote/queryCache.js"
import { KIRU_QUERIES_KEY } from "../../remote/querySnapshot.js"

describe("loader query seed", () => {
  it("seeds query cache from __kiruQueries payload", () => {
    const queryId = "r:demo:counter"
    const input = null
    const data = { count: 3 }
    const payload = attachQueriesToPayload(
      { ok: true },
      [{ queryId, input, data }]
    )
    assert.ok(
      payload &&
        typeof payload === "object" &&
        KIRU_QUERIES_KEY in (payload as object)
    )

    const seeded = seedQueriesFromPayload(payload) as { ok: boolean }
    assert.equal(seeded.ok, true)

    const key = buildQueryCacheKey(queryId, input)
    assert.deepEqual(getQueryCacheEntry(key)?.data, data)
  })
})

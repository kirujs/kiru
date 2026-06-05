import { describe, it, beforeEach, afterEach } from "node:test"
import assert from "node:assert/strict"
import { JSDOM } from "jsdom"
import {
  attachQueriesToPayload,
  seedQueriesFromPayload,
} from "../../remote/pageDataQueries.js"
import {
  buildQueryCacheKey,
  buildQueryWireRefId,
  clearAllQueryCache,
  getQueryCacheEntry,
  getQueryCacheEntryForKey,
} from "../../remote/queryCache.js"
import { KIRU_QUERIES_KEY } from "../../remote/querySnapshot.js"
import {
  KIRU_QUERY_REF_KEY,
  serializeKDataScript,
} from "../../router/dataRefs.js"
import { readHydratedPageData, resetHydratedPageData } from "../../router/pageData.js"
import { resetQueryInjectionRegistry } from "../../ssr/queryInjection.js"

describe("loader query seed", () => {
  let dom: JSDOM
  let prevDocument: (typeof globalThis)["document"]

  beforeEach(() => {
    clearAllQueryCache()
    resetHydratedPageData()
    resetQueryInjectionRegistry()
  })

  afterEach(() => {
    if (prevDocument !== undefined) {
      ;(globalThis as { document: Document }).document = prevDocument
    }
    clearAllQueryCache()
    resetHydratedPageData()
    resetQueryInjectionRegistry()
  })

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

  it("seeds query cache from k-data plus nested $$ref page data", () => {
    const queryId = "r:demo:counter"
    const input = null
    const data = 3
    const cacheKey = buildQueryCacheKey(queryId, input)
    const wireRefId = buildQueryWireRefId(cacheKey)

    dom = new JSDOM("<!doctype html><html><head></head><body></body></html>")
    prevDocument = globalThis.document
    ;(globalThis as { document: Document }).document = dom.window.document

    dom.window.document.head.innerHTML =
      serializeKDataScript(wireRefId, { data }) +
      `<script type="application/json" k-page-data>${JSON.stringify({
        count: { [KIRU_QUERY_REF_KEY]: wireRefId },
      })}</script>`

    const seeded = readHydratedPageData() as { count: number }
    assert.equal(seeded.count, 3)

    const key = buildQueryCacheKey(queryId, input)
    assert.deepEqual(getQueryCacheEntryForKey(key)?.data, data)
  })
})

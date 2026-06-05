import assert from "node:assert/strict"
import { describe, it, beforeEach, afterEach } from "node:test"
import { JSDOM } from "jsdom"
import {
  buildQueryCacheKey,
  buildQueryWireRefId,
  clearAllQueryCache,
  getQueryCacheEntryForKey,
} from "../../remote/queryCache.js"
import {
  KIRU_QUERY_REF_KEY,
  resolveStreamRefPayload,
  resetClientKDataStore,
  serializeKDataScript,
} from "../../router/dataRefs.js"
import { readHydratedPageData, resetHydratedPageData } from "../../router/pageData.js"
import {
  buildPageDataPayloadFromRegistry,
  registerQueryInjection,
  resetQueryInjectionRegistry,
} from "../../ssr/queryInjection.js"

describe("page data refs", () => {
  let dom: JSDOM
  let prevDocument: (typeof globalThis)["document"]

  beforeEach(() => {
    resetQueryInjectionRegistry()
    clearAllQueryCache()
    resetHydratedPageData()
    dom = new JSDOM("<!doctype html><html><head></head><body></body></html>")
    prevDocument = globalThis.document
    ;(globalThis as { document: Document }).document = dom.window.document
  })

  afterEach(() => {
    ;(globalThis as { document: Document }).document = prevDocument
    resetQueryInjectionRegistry()
    clearAllQueryCache()
    resetHydratedPageData()
  })

  it("buildPageDataPayloadFromRegistry emits nested $$ref with wire ref id", () => {
    const posts = [{ id: "p1" }]
    const wireRefId = registerQueryInjection("r:test:feed", { sort: "hot" }, {
      ok: true,
      data: posts,
    })
    const payload = buildPageDataPayloadFromRegistry({ posts }) as {
      posts: Record<string, string>
    }
    assert.deepEqual(payload.posts, { [KIRU_QUERY_REF_KEY]: wireRefId })
    assert.match(wireRefId, /^k:q:/)
  })

  it("readHydratedPageData resolves nested $$ref and seeds query cache", () => {
    const posts = [{ id: "p1" }]
    const queryId = "r:test:feed"
    const input = { sort: "hot" }
    const cacheKey = buildQueryCacheKey(queryId, input)
    const wireRefId = buildQueryWireRefId(cacheKey)
    const kData = serializeKDataScript(wireRefId, { data: posts })
    const pageData = `<script type="application/json" k-page-data>${JSON.stringify({
      posts: { [KIRU_QUERY_REF_KEY]: wireRefId },
    })}</script>`
    dom.window.document.head.innerHTML = kData + "\n" + pageData

    const data = readHydratedPageData() as { posts: typeof posts }
    assert.deepEqual(data.posts, posts)
    assert.deepEqual(getQueryCacheEntryForKey(cacheKey)?.data, posts)
    assert.equal(dom.window.document.querySelector("script[k-data]"), null)
    assert.equal(
      dom.window.document.querySelector(`script[k-data="${wireRefId}"]`),
      null
    )
    assert.equal(dom.window.document.querySelector("script[k-page-data]"), null)
  })

  it("resolveStreamRefPayload ingests late-streamed k-data scripts from the document", () => {
    const communities = [{ id: "c1", slug: "kiru" }]
    const wireRefId = buildQueryWireRefId(
      buildQueryCacheKey("r:test:communities", null)
    )
    readHydratedPageData()
    dom.window.document.body.innerHTML = serializeKDataScript(wireRefId, {
      data: communities,
    })

    const resolved = resolveStreamRefPayload({
      data: { [KIRU_QUERY_REF_KEY]: wireRefId },
    })
    assert.deepEqual(resolved, { data: communities })
    assert.equal(dom.window.document.querySelectorAll("script[k-data]").length, 0)
    resetClientKDataStore()
  })

  it("resolveStreamRefPayload ingests k-data when wire ref contains colons", () => {
    const wireRefId = "k:q:test:colon:ref"
    const payload = { data: [{ id: 1 }] }
    dom.window.document.body.innerHTML = serializeKDataScript(wireRefId, payload)

    const resolved = resolveStreamRefPayload({
      data: { [KIRU_QUERY_REF_KEY]: wireRefId },
    })
    assert.deepEqual(resolved, payload)
    resetClientKDataStore()
  })
})

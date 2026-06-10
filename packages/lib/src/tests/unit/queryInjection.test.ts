import assert from "node:assert/strict"
import { describe, it, afterEach } from "node:test"
import {
  decodeQueryRefAttr,
  embedRefsFromRegistry,
  embedRefsInValue,
  encodeQueryRefAttr,
  KIRU_QUERY_REF_KEY,
} from "../../router/dataRefs.js"
import {
  buildPageDataPayloadFromRegistry,
  collectInjectedQueryScriptTags,
  markQueryInjectionHeadEmitted,
  registerQueryInjection,
  resetQueryInjectionRegistry,
  setQueryInjectionStreamEmitter,
} from "../../ssr/queryInjection.js"
import {
  buildQueryCacheKey,
  buildQueryWireRefId,
  clearAllQueryCache,
} from "../../remote/queryCache.js"

describe("query injection registry", () => {
  afterEach(() => {
    resetQueryInjectionRegistry()
    clearAllQueryCache()
  })

  it("dedupes registrations for the same cache key", () => {
    const queryId = "r:test:feed"
    const input = { sort: "hot" }
    const refA = registerQueryInjection(queryId, input, {
      ok: true,
      data: [{ id: "p1" }],
    })
    const refB = registerQueryInjection(queryId, input, {
      ok: true,
      data: [{ id: "p1" }],
    })
    assert.equal(refA, refB)
    assert.equal(refA, buildQueryWireRefId(buildQueryCacheKey(queryId, input)))
  })

  it("encodeQueryRefAttr round-trips wire ref ids for k-data attributes", () => {
    const wireRefId = buildQueryWireRefId('r:test:feed:{"sort":"hot"}')
    assert.match(wireRefId, /^k:q:/)
    assert.equal(decodeQueryRefAttr(encodeQueryRefAttr(wireRefId)), wireRefId)
  })

  it("embedRefsInValue maps matching subtrees to $$ref cache keys", () => {
    const posts = [{ id: "p1", title: "Hello" }]
    const cacheKey = "r:test:feed:null"
    const lookup = new Map([[JSON.stringify(posts), cacheKey]])
    const embedded = embedRefsInValue({ posts, meta: "home" }, lookup) as {
      posts: Record<string, string>
      meta: string
    }
    assert.deepEqual(embedded.posts, { [KIRU_QUERY_REF_KEY]: cacheKey })
    assert.equal(embedded.meta, "home")
  })

  it("buildPageDataPayloadFromRegistry embeds multiple query refs by cache key", () => {
    const feed = [{ id: "p1" }]
    const sidebar = [{ id: "c1" }]
    const feedKey = registerQueryInjection("r:test:feed", null, {
      ok: true,
      data: feed,
    })
    const sidebarKey = registerQueryInjection("r:test:sidebar", null, {
      ok: true,
      data: sidebar,
    })
    const payload = buildPageDataPayloadFromRegistry({
      posts: feed,
      sidebar,
    }) as Record<string, Record<string, string>>
    assert.deepEqual(payload.posts, { [KIRU_QUERY_REF_KEY]: feedKey })
    assert.deepEqual(payload.sidebar, { [KIRU_QUERY_REF_KEY]: sidebarKey })
    assert.notEqual(feedKey, sidebarKey)
  })

  it("collectInjectedQueryScriptTags emits wire ref ids on k-data attributes", () => {
    const queryId = "r:test:feed"
    const wireRefId = registerQueryInjection(queryId, null, {
      ok: true,
      data: [{ id: "p1" }],
    })
    const html = collectInjectedQueryScriptTags()
    assert.match(html, new RegExp(`k-data="${wireRefId}"`))
    assert.match(html, /"data":\[{"id":"p1"}\]/)
    assert.ok(!html.includes('"input"'))
    assert.ok(!html.includes('"queryId"'))
  })

  it("streams k-data on late registration after head emit without duplicates", () => {
    const streamed: string[] = []
    setQueryInjectionStreamEmitter((script) => {
      streamed.push(script)
    })

    const queryId = "r:test:feed"
    registerQueryInjection(queryId, { sort: "hot" }, {
      ok: true,
      data: [{ id: "p1" }],
    })
    collectInjectedQueryScriptTags()
    assert.equal(streamed.length, 0, "pre-head registrations should not stream")

    const lateRef = registerQueryInjection(
      queryId,
      { sort: "new" },
      { ok: true, data: [{ id: "p2" }] }
    )
    assert.equal(streamed.length, 1)
    assert.match(streamed[0]!, new RegExp(`k-data="${lateRef}"`))

    registerQueryInjection(queryId, { sort: "new" }, {
      ok: true,
      data: [{ id: "p2-changed" }],
    })
    assert.equal(streamed.length, 1, "cache-hit re-register should not re-stream")

    setQueryInjectionStreamEmitter(null)
  })

  it("markQueryInjectionHeadEmitted alone does not stream scripts", () => {
    registerQueryInjection("r:test:feed", null, {
      ok: true,
      data: [{ id: "p1" }],
    })
    markQueryInjectionHeadEmitted()
    const streamed: string[] = []
    setQueryInjectionStreamEmitter((script) => {
      streamed.push(script)
    })
    registerQueryInjection("r:test:sidebar", null, {
      ok: true,
      data: [{ id: "c1" }],
    })
    assert.equal(streamed.length, 1)
    setQueryInjectionStreamEmitter(null)
  })

  it("uses buildQueryCacheKey for dedupe identity", () => {
    const queryId = "r:test:counter"
    const input = null
    registerQueryInjection(queryId, input, { ok: true, data: { count: 1 } })
    const key = buildQueryCacheKey(queryId, input)
    const ref = registerQueryInjection(queryId, input, { ok: true, data: { count: 2 } })
    assert.equal(ref, buildQueryWireRefId(key))
    assert.match(
      collectInjectedQueryScriptTags(),
      /"data":\{"count":1\}/
    )
  })

  describe("value collision", () => {
    it("skips embedding when multiple queries share identical serialized data", () => {
      const shared: unknown[] = []
      registerQueryInjection("r:test:posts", { sort: "hot" }, {
        ok: true,
        data: shared,
      })
      registerQueryInjection("r:test:posts", { sort: "new" }, {
        ok: true,
        data: shared,
      })

      const payload = buildPageDataPayloadFromRegistry({
        hotPosts: shared,
        newPosts: shared,
      }) as Record<string, unknown>

      assert.deepEqual(payload.hotPosts, shared)
      assert.deepEqual(payload.newPosts, shared)
      assert.ok(!JSON.stringify(payload).includes(KIRU_QUERY_REF_KEY))
    })

    it("embedRefsFromRegistry still embeds unique payloads with distinct cache keys", () => {
      const hot = [{ id: "hot-1" }]
      const newPosts = [{ id: "new-1" }]
      const hotKey = buildQueryCacheKey("r:test:posts", { sort: "hot" })
      const newKey = buildQueryCacheKey("r:test:posts", { sort: "new" })

      const embedded = embedRefsFromRegistry(
        { hotPosts: hot, newPosts },
        [
          { wireRefId: buildQueryWireRefId(hotKey), payload: { data: hot } },
          {
            wireRefId: buildQueryWireRefId(newKey),
            payload: { data: newPosts },
          },
        ]
      ) as Record<string, Record<string, string>>

      assert.deepEqual(embedded.hotPosts, {
        [KIRU_QUERY_REF_KEY]: buildQueryWireRefId(hotKey),
      })
      assert.deepEqual(embedded.newPosts, {
        [KIRU_QUERY_REF_KEY]: buildQueryWireRefId(newKey),
      })
    })
  })
})

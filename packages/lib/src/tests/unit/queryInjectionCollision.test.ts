import assert from "node:assert/strict"
import { describe, it, afterEach } from "node:test"
import {
  embedRefsFromRegistry,
  KIRU_QUERY_REF_KEY,
} from "../../router/dataRefs.js"
import {
  buildPageDataPayloadFromRegistry,
  registerQueryInjection,
  resetQueryInjectionRegistry,
} from "../../ssr/queryInjection.js"
import { buildQueryCacheKey, buildQueryWireRefId } from "../../remote/queryCache.js"

describe("query injection value collision", () => {
  afterEach(() => {
    resetQueryInjectionRegistry()
  })

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
        { wireRefId: buildQueryWireRefId(newKey), payload: { data: newPosts } },
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

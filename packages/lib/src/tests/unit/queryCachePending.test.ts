import assert from "node:assert/strict"
import { describe, it, afterEach } from "node:test"
import { signal } from "../../signals/base.js"
import { resource } from "../../resource.js"
import { renderMode } from "../../globals.js"
import { query } from "../../remote/query.js"
import {
  buildQueryCacheKey,
  clearAllQueryCache,
  setQueryCachePending,
} from "../../remote/queryCache.js"
import { runWithSsrRemoteContext } from "../../remote/ssrRemoteScope.js"
import { staticLoaderSignal } from "../../router/navigationScope.js"

const feedSchema = {
  parse: (input: unknown) => {
    if (
      input &&
      typeof input === "object" &&
      "sort" in input &&
      (input as { sort: unknown }).sort === "new"
    ) {
      return { sort: "new" as const }
    }
    return { sort: "hot" as const }
  },
}

describe("query cache pending poisoning", () => {
  const prevFetch = globalThis.fetch
  let fetchCalls = 0

  afterEach(() => {
    globalThis.fetch = prevFetch
    clearAllQueryCache()
    renderMode.current = "dom"
  })

  it("resource does not reuse a rejected pending entry when scope is available", async () => {
    fetchCalls = 0
    globalThis.fetch = async () => {
      fetchCalls += 1
      throw new Error("Failed to parse URL from /?query=r_test:getFeed")
    }

    const getFeed = query(feedSchema, async ({ sort }) => [
      { id: "ok", sort },
    ])
    getFeed.__kiruQueryId = "r_test:getFeed"

    const cacheKey = buildQueryCacheKey("r_test:getFeed", { sort: "hot" })
    const rejected = Promise.reject(
      new Error("Failed to parse URL from /?query=r_test:getFeed")
    )
    rejected.catch(() => {})
    setQueryCachePending(cacheKey, rejected)

    const prevMode = renderMode.current
    renderMode.current = "stream"
    try {
      const sort = signal<"hot" | "new">("hot")
      const posts = await runWithSsrRemoteContext({}, staticLoaderSignal(), () => {
        const feed = resource({
          source: { sort },
          load: getFeed,
          defaultState: [] as Array<{ id: string; sort: string }>,
        })
        return feed.promise
      })
      assert.equal(fetchCalls, 0)
      assert.deepEqual(posts, [{ id: "ok", sort: "hot" }])
    } finally {
      renderMode.current = prevMode
    }
  })
})

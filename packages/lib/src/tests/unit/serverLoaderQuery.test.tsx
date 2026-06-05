import assert from "node:assert/strict"
import { describe, it, afterEach } from "node:test"
import * as kiru from "../../index.js"
import { Derive } from "../../components/derive.js"
import { resource } from "../../resource.js"
import { signal } from "../../signals/base.js"
import { __INTERNAL_REMOTE_REGISTRY } from "../../remote/index.js"
import { getRequestEvent, query } from "../../remote/index.js"
import {
  buildQueryCacheKey,
  clearAllQueryCache,
  setQueryCacheEntry,
} from "../../remote/queryCache.js"
import {
  getAllQueryInjectionEntries,
  resetQueryInjectionRegistry,
} from "../../ssr/queryInjection.js"
import {
  compileRouteTree,
  createRenderer,
  createRoute,
  createRouteTree,
} from "../../router/index.js"
import { runPageLoadFromModule } from "../../router/runPageLoad.js"
import { serverLoader } from "../../router/loaders.js"
import { staticLoaderSignal } from "../../router/navigationScope.js"

const MINIMAL_TPL =
  "<!doctype html><html><head>{{kiru_head}}</head><body>{{kiru_body}}</body></html>"
const STREAM_SECRET = "test-stream-loader-query-secret"

const feedSchema = {
  parse: (input: unknown) => {
    if (!input || typeof input !== "object") {
      return { sort: "hot" as const }
    }
    const record = input as { sort?: unknown; communitySlug?: unknown }
    const sort = record.sort === "new" ? ("new" as const) : ("hot" as const)
    const communitySlug =
      typeof record.communitySlug === "string" && record.communitySlug
        ? record.communitySlug
        : undefined
    return communitySlug === undefined
      ? { sort }
      : { sort, communitySlug }
  },
}

describe("serverLoader + parametric query on server", () => {
  const prevFetch = globalThis.fetch
  let fetchCalls = 0

  afterEach(() => {
    globalThis.fetch = prevFetch
    clearAllQueryCache()
    resetQueryInjectionRegistry()
  })

  it("runPageLoadFromModule invokes query in-process without fetch", async () => {
    fetchCalls = 0
    globalThis.fetch = async () => {
      fetchCalls += 1
      throw new Error("fetch should not be called for in-process server loader query")
    }

    const seen: Array<{ sort: string; context: Record<string, unknown> }> = []
    const getFeed = query(feedSchema, async ({ sort }) => {
      const { context } = getRequestEvent()
      seen.push({ sort, context: context as Record<string, unknown> })
      return [{ id: "p1", sort }]
    })
    getFeed.__kiruQueryId = "r_test_feed:getFeed"
    __INTERNAL_REMOTE_REGISTRY.register("test/feed", { getFeed })

    const load = serverLoader(async () => {
      const posts = await getFeed({ sort: "hot" })
      return { posts }
    })

    const loaderCtx = {
      params: {},
      url: { pathname: "/", search: "", hash: "" },
      query: {},
      context: { user: { name: "ada" } },
      meta: {},
      route: { id: "r_test_home" },
      signal: staticLoaderSignal(),
    }

    const data = (await runPageLoadFromModule({ load }, loaderCtx)) as {
      posts: Array<{ id: string; sort: string }>
    }

    assert.equal(fetchCalls, 0)
    assert.equal(seen.length, 1)
    assert.equal(seen[0]!.sort, "hot")
    assert.deepEqual(seen[0]!.context, { user: { name: "ada" } })
    assert.deepEqual(data.posts, [{ id: "p1", sort: "hot" }])
  })

  it("streaming SSR with serverLoader query and resource does not fetch or stream errors", async () => {
    fetchCalls = 0
    globalThis.fetch = async () => {
      fetchCalls += 1
      throw new Error("fetch should not be called during streaming SSR")
    }

    const getFeed = query(feedSchema, async ({ sort }) => [
      { id: "p1", sort },
    ])
    getFeed.__kiruQueryId = "r_test_stream:getFeed"
    __INTERNAL_REMOTE_REGISTRY.register("test/stream", { getFeed })

    const load = serverLoader(async () => {
      const posts = await getFeed({ sort: "hot" })
      return { posts }
    })

    const routes = createRouteTree({
      children: [
        createRoute("/", {
          component: async () => ({
            load,
            default: function HomePage() {
              const sort = signal<"hot" | "new">("hot")
              const feed = resource({
                source: { sort },
                load: getFeed,
                defaultState: [] as Array<{ id: string; sort: string }>,
              })
              return () => (
                <Derive
                  from={feed}
                  fallback={<p data-testid="feed-fallback">Loading feed…</p>}
                >
                  {(posts) => (
                    <ul data-testid="feed-list">
                      {posts.map((p) => (
                        <li key={p.id}>{p.id}</li>
                      ))}
                    </ul>
                  )}
                </Derive>
              )
            },
          }),
        }),
      ],
    })
    compileRouteTree(routes)

    const renderer = createRenderer({
      stream: true,
      routes,
      htmlTemplate: MINIMAL_TPL,
      actions: { secret: STREAM_SECRET },
    })

    const response = await renderer.render("/", { context: {} })
    assert.ok(response)
    const reader = (response.body as ReadableStream<string>).getReader()
    let html = ""
    while (true) {
      const next = await reader.read()
      if (next.done) break
      html += next.value
    }
    reader.releaseLock()

    assert.equal(fetchCalls, 0)
    assert.ok(
      !html.includes("Failed to parse URL"),
      `unexpected query RPC error in stream: ${html}`
    )
    assert.ok(
      !html.includes('"error"'),
      `stream should not contain resource errors: ${html}`
    )
    assert.ok(html.includes("p1"), "stream should include resolved feed data")
    assert.ok(
      !html.includes("Loading feed"),
      "shell should render resolved feed, not fallback"
    )
    assert.ok(
      html.includes('k-data="'),
      "getFeed should be injected once as canonical k-data"
    )
    assert.ok(
      html.includes('k-page-data'),
      "page data script should be present"
    )
    assert.ok(
      html.includes('"$$ref":"k:q:') && html.includes('"$$ref":'),
      "k-page-data should reference canonical query data via nested $$ref wire id"
    )
    assert.ok(
      html.includes('"posts":{') &&
        html.includes("sort") &&
        html.includes("hot"),
      "k-page-data should embed $$ref under loader field with hot sort cache key"
    )
    const kDataMatches = html.match(/k-data="/g) ?? []
    assert.equal(kDataMatches.length, 1, "k-data should appear exactly once")
    const fullPostPayloads = html.match(/\{"id":"p1","sort":"hot"\}/g) ?? []
    assert.ok(
      fullPostPayloads.length <= 2,
      `expected deduped payloads, got ${fullPostPayloads.length} full post blobs`
    )
  })

  it("dedupes loader and resource when resource source has optional undefined field", async () => {
    fetchCalls = 0
    globalThis.fetch = async () => {
      fetchCalls += 1
      throw new Error("fetch should not be called during streaming SSR")
    }

    const getFeed = query(feedSchema, async ({ sort }) => [
      { id: "p1", sort },
    ])
    getFeed.__kiruQueryId = "r_test_optional:getFeed"
    __INTERNAL_REMOTE_REGISTRY.register("test/optional", { getFeed })

    const load = serverLoader(async () => {
      const posts = await getFeed({ sort: "hot" })
      return { posts }
    })

    const routes = createRouteTree({
      children: [
        createRoute("/", {
          component: async () => ({
            load,
            default: function HomePage() {
              const sort = signal<"hot" | "new">("hot")
              const communitySlug = signal<string | undefined>(undefined)
              const feed = resource({
                source: { sort, communitySlug },
                load: getFeed,
                defaultState: [] as Array<{ id: string; sort: string }>,
              })
              return () => (
                <Derive
                  from={feed}
                  fallback={<p data-testid="feed-fallback">Loading feed…</p>}
                >
                  {(posts) => (
                    <ul data-testid="feed-list">
                      {posts.map((p) => (
                        <li key={p.id}>{p.id}</li>
                      ))}
                    </ul>
                  )}
                </Derive>
              )
            },
          }),
        }),
      ],
    })
    compileRouteTree(routes)

    const renderer = createRenderer({
      stream: true,
      routes,
      htmlTemplate: MINIMAL_TPL,
      actions: { secret: STREAM_SECRET },
    })

    const response = await renderer.render("/", { context: {} })
    assert.ok(response)
    const reader = (response.body as ReadableStream<string>).getReader()
    let html = ""
    while (true) {
      const next = await reader.read()
      if (next.done) break
      html += next.value
    }
    reader.releaseLock()

    assert.equal(fetchCalls, 0)
    assert.ok(html.includes("p1"), "stream should include resolved feed data")
    assert.ok(
      !html.includes("Loading feed"),
      "shell should render resolved feed, not fallback"
    )

    const kDataAttr = html.match(/k-data="(k:q:[^"]+)"/)?.[1]
    assert.ok(kDataAttr, "expected canonical k-data wire ref in head")
    const kDataMatches = html.match(/k-data="/g) ?? []
    assert.equal(kDataMatches.length, 1, "k-data should appear exactly once")

    const streamTail = html.split("__$k_data").slice(1).join("__$k_data")
    if (streamTail.length > 0) {
      assert.ok(
        streamTail.includes(`"$$ref":"${kDataAttr}"`) ||
          streamTail.includes(`"$$ref": "${kDataAttr}"`),
        "when streamed, resource $$ref should match head k-data wire ref"
      )
    }
  })

  it("registers injection for cache hits during serverLoader", async () => {
    const getFeed = query(feedSchema, async ({ sort }) => [
      { id: sort, sort },
    ])
    const queryId = "r_test_cache:getFeed"
    getFeed.__kiruQueryId = queryId
    __INTERNAL_REMOTE_REGISTRY.register("test/cache", { getFeed })

    setQueryCacheEntry(
      buildQueryCacheKey(queryId, { sort: "hot" }),
      [{ id: "hot", sort: "hot" }]
    )

    const load = serverLoader(async () => {
      const [hotPosts, newPosts] = await Promise.all([
        getFeed({ sort: "hot" }),
        getFeed({ sort: "new" }),
      ])
      return { hotPosts, newPosts }
    })

    const loaderCtx = {
      params: {},
      url: { pathname: "/dedup", search: "", hash: "" },
      query: {},
      context: {},
      meta: {},
      route: { id: "r_test_dedup" },
      signal: staticLoaderSignal(),
    }

    const data = (await runPageLoadFromModule({ load }, loaderCtx)) as {
      hotPosts: Array<{ id: string; sort: string }>
      newPosts: Array<{ id: string; sort: string }>
    }

    assert.deepEqual(data.hotPosts, [{ id: "hot", sort: "hot" }])
    assert.deepEqual(data.newPosts, [{ id: "new", sort: "new" }])
    assert.equal(
      getAllQueryInjectionEntries().length,
      2,
      "cache-hit and fresh queries should both register for injection"
    )
  })
})

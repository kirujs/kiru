import assert from "node:assert/strict"
import { afterEach, describe, it } from "node:test"
import * as kiru from "../../index.js"
import { Derive } from "../../components/derive.js"
import { resource } from "../../resource.js"
import { signal } from "../../signals/base.js"
import { __INTERNAL_REMOTE_REGISTRY, query } from "../../remote/index.js"
import {
  buildQueryCacheKey,
  buildQueryWireRefId,
  clearAllQueryCache,
} from "../../remote/queryCache.js"
import {
  resetClientKDataStore,
} from "../../router/dataRefs.js"
import {
  clearStreamedSsrClientState,
  resetHydratedPageData,
} from "../../router/pageData.js"
import { createRoute, createRouteTree } from "../../router/createRouteTree.js"
import { compileRouteTree } from "../../router/manifest.js"
import { serverLoader } from "../../router/loaders.js"
import { bootstrapSsrClient } from "../../ssr/routerHydrate.js"
import { STREAMED_DATA_EVENT } from "../../constants.js"
import { withJSDOM } from "./jsdom.js"
import { serializeKDataScript } from "../../router/dataRefs.js"
import {
  buildKDataHeadScripts,
  feedSchema,
  waitForSelector,
} from "./helpers/hydrationFixtures.js"

describe("SSR hydration bootstrap", () => {
  afterEach(() => {
    clearAllQueryCache()
    resetHydratedPageData()
    resetClientKDataStore()
    clearStreamedSsrClientState()
  })

  it("hydrates feed from head k-data when resource source has optional undefined field", async () => {
    const getFeed = query(feedSchema, async ({ sort }) => [
      { id: `${sort}-post-1`, title: `${sort} post one`, sort },
    ])
    getFeed.__kiruQueryId = "r_feed_hydration:getFeed"
    __INTERNAL_REMOTE_REGISTRY.register("feed/hydration-feed", { getFeed })

    const load = serverLoader(async () => ({
      posts: await getFeed({ sort: "hot" }),
    }))

    const routes = createRouteTree({
      children: [
        createRoute("/feed-hydration-demo", {
          component: async () => ({
            load,
            default: function FeedHydrationDemoPage() {
              const sort = signal<"hot" | "new">("hot")
              const communitySlug = signal<string | undefined>(undefined)
              const feed = resource({
                source: { sort, communitySlug },
                load: getFeed,
                defaultState: [] as Array<{ id: string; title: string }>,
              })

              return () => (
                <section data-testid="feed-hydration-demo">
                  <Derive
                    from={feed}
                    fallback={
                      <p data-testid="feed-fallback">Loading feed…</p>
                    }
                  >
                    {(posts) => (
                      <ul data-testid="feed-list">
                        {posts.map((post) => (
                          <li
                            key={post.id}
                            data-testid={`feed-post-${post.id}`}
                          >
                            {post.title}
                          </li>
                        ))}
                      </ul>
                    )}
                  </Derive>
                </section>
              )
            },
          }),
        }),
      ],
    })

    const feedWireRef = buildQueryWireRefId(
      buildQueryCacheKey("r_feed_hydration:getFeed", { sort: "hot" })
    )

    await withJSDOM(
      async (container) => {
        document.head.innerHTML = buildKDataHeadScripts(
          feedWireRef,
          [{ id: "hot-post-1", title: "hot post one", sort: "hot" }],
          { posts: { $$ref: feedWireRef } }
        )

        container.innerHTML = `<section data-testid="feed-hydration-demo"><ul data-testid="feed-list"><li data-testid="feed-post-hot-post-1">hot post one</li></ul></section>`

        const manifest = compileRouteTree(routes)
        const app = await bootstrapSsrClient({
          routes: manifest,
          container,
        })
        await new Promise((resolve) => setTimeout(resolve, 0))

        assert.ok(
          container.querySelector('[data-testid="feed-post-hot-post-1"]'),
          `expected feed post after hydrate, got: ${container.innerHTML}`
        )
        assert.equal(
          container.querySelector('[data-testid="feed-fallback"]'),
          null
        )
        app.unmount()
      },
      { url: "http://localhost/feed-hydration-demo" }
    )
  })

  it("hydrates layout communities from streamed tail after bootstrap", async () => {
    const listCommunities = query(async () => [
      { id: "c-kiru", slug: "kiru", name: "kiru" },
    ])
    listCommunities.__kiruQueryId = "r_threadboard:listCommunities"
    __INTERNAL_REMOTE_REGISTRY.register("threadboard/feed", { listCommunities })

    const getFeed = query(async () => [
      { id: "p-1", title: "How does query cache seeding work" },
    ])
    getFeed.__kiruQueryId = "r_threadboard:getFeed"
    __INTERNAL_REMOTE_REGISTRY.register("threadboard/feed", { getFeed })

    const load = serverLoader(async () => ({
      posts: await getFeed({}),
    }))

    function CommunitiesSidebar() {
      const communities = resource({
        load: listCommunities,
        defaultState: [] as Array<{ id: string; slug: string }>,
      })
      return () => (
        <Derive
          from={communities}
          fallback={
            <p data-testid="communities-fallback">Loading…</p>
          }
        >
          {(list) => (
            <ul data-testid="communities-list">
              {list.map((c) => (
                <li key={c.id} data-testid={`community-${c.slug}`}>
                  c/{c.slug}
                </li>
              ))}
            </ul>
          )}
        </Derive>
      )
    }

    function ThreadboardLayout() {
      return ({ children }: { children: JSX.Children }) => (
        <div data-testid="threadboard-layout">
          <CommunitiesSidebar />
          <main>{children}</main>
        </div>
      )
    }

    const routes = createRouteTree({
      layout: async () => ({ default: ThreadboardLayout }),
      children: [
        createRoute("/threadboard", {
          component: async () => ({
            load,
            default: function ThreadboardHome() {
              return (
                <div data-testid="threadboard-home">
                  <p>How does query cache seeding work</p>
                </div>
              )
            },
          }),
        }),
      ],
    })

    const feedWireRef = buildQueryWireRefId(
      buildQueryCacheKey("r_threadboard:getFeed", null)
    )
    const communitiesWireRef = buildQueryWireRefId(
      buildQueryCacheKey("r_threadboard:listCommunities", null)
    )
    const communities = [{ id: "c-kiru", slug: "kiru", name: "kiru" }]

    await withJSDOM(
      async (container) => {
        ;(window as unknown as Record<string, unknown>)[STREAMED_DATA_EVENT] =
          new window.Map()

        document.head.innerHTML = buildKDataHeadScripts(
          feedWireRef,
          [{ id: "p-1", title: "How does query cache seeding work" }],
          { posts: { $$ref: feedWireRef } }
        )

        document.body.insertAdjacentHTML(
          "afterend",
          serializeKDataScript(communitiesWireRef, { data: communities }) +
            `<script type="text/javascript">__$k_data("k:test:resource:0",${JSON.stringify(
              { data: { $$ref: communitiesWireRef } }
            )})</script>`
        )

        container.innerHTML = `<div data-testid="threadboard-layout"><p data-testid="communities-fallback">Loading…</p><main><div data-testid="threadboard-home"><p>How does query cache seeding work</p></div></main></div>`

        const manifest = compileRouteTree(routes)
        await bootstrapSsrClient({
          routes: manifest,
          container,
        })
        await waitForSelector(container, '[data-testid="community-kiru"]', 10_000)
        await new Promise((resolve) => setTimeout(resolve, 100))

        assert.ok(
          container.querySelector('[data-testid="community-kiru"]'),
          `expected community after hydrate, got: ${container.innerHTML}`
        )
        assert.equal(
          container.querySelector('[data-testid="communities-fallback"]'),
          null
        )
      },
      { url: "http://localhost/threadboard" }
    )
  })
})

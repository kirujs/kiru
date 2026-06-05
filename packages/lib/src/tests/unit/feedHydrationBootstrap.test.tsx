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
import { serializeKDataScript } from "../../router/dataRefs.js"
import { resetClientKDataStore } from "../../router/dataRefs.js"
import {
  clearStreamedSsrClientState,
  resetHydratedPageData,
} from "../../router/pageData.js"
import { createRoute, createRouteTree } from "../../router/createRouteTree.js"
import { compileRouteTree } from "../../router/manifest.js"
import { serverLoader } from "../../router/loaders.js"
import { bootstrapSsrClient } from "../../ssr/routerHydrate.js"
import { withJSDOM } from "./jsdom.js"

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

describe("feed hydration bootstrap (Threadboard pattern)", () => {
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
        document.head.innerHTML =
          serializeKDataScript(feedWireRef, {
            data: [{ id: "hot-post-1", title: "hot post one", sort: "hot" }],
          }) +
          `<script type="application/json" k-page-data>${JSON.stringify({
            posts: { $$ref: feedWireRef },
          })}</script>`

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
})

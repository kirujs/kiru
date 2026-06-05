import { Derive, resource, signal } from "kiru"
import { serverLoader } from "kiru/router"
import {
  getFeed,
  listCommunities,
  type Community,
  type FeedPost,
} from "./feed-hydration-demo.remote.js"

/** Sidebar resource registered during shell render (often streams after head flush). */
function CommunitiesSidebar() {
  const communities = resource({
    load: listCommunities,
    defaultState: [] as Community[],
  })

  return () => (
    <Derive
      from={communities}
      fallback={
        <p data-testid="communities-fallback">Loading communities…</p>
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

/**
 * Mirrors sandbox Threadboard: serverLoader uses `{ sort: "hot" }` only;
 * resource source includes optional `communitySlug` from signals.
 */
function FeedListSection() {
  const sort = signal<"hot" | "new">("hot")
  const communitySlug = signal<string | undefined>(undefined)
  const feed = resource({
    source: { sort, communitySlug },
    load: getFeed,
    defaultState: [] as FeedPost[],
  })

  return () => (
    <Derive
      from={feed}
      fallback={<p data-testid="feed-fallback">Loading feed…</p>}
    >
      {(posts) => (
        <ul data-testid="feed-list">
          {posts.map((post) => (
            <li key={post.id} data-testid={`feed-post-${post.id}`}>
              {post.title}
            </li>
          ))}
        </ul>
      )}
    </Derive>
  )
}

export const load = serverLoader(async () => {
  const posts = await getFeed({ sort: "hot" })
  return { posts }
})

export default function FeedHydrationDemoPage() {
  return () => (
    <section data-testid="feed-hydration-demo">
      <h1>Feed hydration demo</h1>
      <div className="feed-hydration-grid">
        <aside data-testid="communities-sidebar">
          <h2>Communities</h2>
          <CommunitiesSidebar />
        </aside>
        <div data-testid="feed-main">
          <h2>Feed</h2>
          <FeedListSection />
        </div>
      </div>
    </section>
  )
}

import { Derive, resource, signal } from "kiru"
import { serverLoader, type PageProps } from "kiru/router"
import { getPosts } from "./query-dedup-demo.remote.js"

function HotPostsResource() {
  const sort = signal<"hot">("hot")
  const communitySlug = signal<string | undefined>(undefined)
  const posts = resource({
    source: { sort, communitySlug },
    load: getPosts,
    defaultState: [],
  })

  return () => (
    <Derive
      from={posts}
      fallback={<p data-testid="hot-resource-fallback">Loading hot resource…</p>}
    >
      {(items) => (
        <ul data-testid="hot-resource-list">
          {items.map((post) => (
            <li key={post.id} data-testid={`hot-resource-${post.id}`}>
              {post.label}
            </li>
          ))}
        </ul>
      )}
    </Derive>
  )
}

export const load = serverLoader(async () => {
  const [hotPosts, newPosts] = await Promise.all([
    getPosts({ sort: "hot" }),
    getPosts({ sort: "new" }),
  ])
  return { hotPosts, newPosts }
})

export default function QueryDedupDemoPage({ data }: PageProps<typeof load>) {
  return () => (
    <section data-testid="query-dedup-demo">
      <h1>Query dedup demo</h1>
      <ul data-testid="hot-loader-list">
        {data?.hotPosts.map((post) => (
          <li key={post.label} data-testid={`hot-loader-${post.label}`}>
            {post.label}
          </li>
        ))}
      </ul>
      <ul data-testid="new-loader-list">
        {data?.newPosts.map((post) => (
          <li key={post.label} data-testid={`new-loader-${post.label}`}>
            {post.label}
          </li>
        ))}
      </ul>
      <HotPostsResource />
    </section>
  )
}

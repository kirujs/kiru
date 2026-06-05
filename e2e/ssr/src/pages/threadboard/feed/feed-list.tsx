import { Derive, resource, signal } from "kiru"
import { Link } from "kiru/router"
import {
  getFeed,
  type FeedPost,
  type FeedSort,
} from "../feed.remote.js"

export type FeedListProps = {
  communitySlug?: string
}

export function FeedList(props: FeedListProps) {
  const sort = signal<FeedSort>("hot")
  const communitySlug = signal(props.communitySlug)
  const feed = resource({
    source: { sort, communitySlug },
    load: getFeed,
    defaultState: [] as FeedPost[],
  })

  return () => (
    <div className="space-y-4" data-testid="feed-list-section">
      <div className="flex gap-2">
        <button
          type="button"
          data-testid="feed-sort-hot"
          className={
            sort.value === "hot"
              ? "rounded-full bg-orange-600 px-3 py-1 text-sm text-white"
              : "rounded-full border px-3 py-1 text-sm"
          }
          onclick={() => {
            sort.value = "hot"
          }}
        >
          Hot
        </button>
        <button
          type="button"
          data-testid="feed-sort-new"
          className={
            sort.value === "new"
              ? "rounded-full bg-orange-600 px-3 py-1 text-sm text-white"
              : "rounded-full border px-3 py-1 text-sm"
          }
          onclick={() => {
            sort.value = "new"
          }}
        >
          New
        </button>
      </div>

      <Derive
        from={feed}
        fallback={
          <p className="text-slate-400" data-testid="feed-fallback">
            Loading feed…
          </p>
        }
      >
        {(posts) => {
          const list = posts as FeedPost[]
          return list.length === 0 ? (
            <p className="text-slate-400" data-testid="feed-empty">
              No posts yet.
            </p>
          ) : (
            <ul className="space-y-3" data-testid="feed-list">
              {list.map((post) => (
                <li
                  key={post.id}
                  data-testid={`feed-post-${post.id}`}
                  className="rounded-lg border p-4"
                >
                  <p className="text-xs text-slate-500">
                    <Link
                      to="/threadboard"
                      className="font-medium text-cyan-300 hover:underline"
                    >
                      c/{post.communitySlug}
                    </Link>
                    <span> · u/{post.authorUsername}</span>
                  </p>
                  <h3 className="mt-1 text-lg font-semibold">{post.title}</h3>
                  <p className="mt-2 line-clamp-3 text-sm text-slate-400">
                    {post.body}
                  </p>
                </li>
              ))}
            </ul>
          )
        }}
      </Derive>
    </div>
  )
}

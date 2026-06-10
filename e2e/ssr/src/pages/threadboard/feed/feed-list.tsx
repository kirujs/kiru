import { Derive, resource, signal, setup, Show } from "kiru"
import { useRequestContext } from "kiru/router"
import { Link } from "kiru/router"
import {
  getFeed,
  votePost,
  type FeedPost,
  type FeedSort,
} from "../feed.remote.js"

export type FeedListProps = {
  communitySlug?: string
}

export const FeedList: Kiru.Component<FeedListProps> = () => {
  const $ = setup<typeof FeedList>()
  const ctx = useRequestContext()
  const sort = signal<FeedSort>("hot")
  const communitySlug = $.derive(({ communitySlug }) => communitySlug)
  const voteError = signal<string | null>(null)
  const feed = resource({
    source: { sort, communitySlug },
    load: getFeed,
    defaultState: [] as FeedPost[],
  })

  async function onVote(postId: string, value: 1 | -1) {
    if (!ctx.user) return
    voteError.value = null
    try {
      await votePost({
        targetType: "post",
        targetId: postId,
        value,
      }).updates(
        getFeed
          .key({ sort: sort.value, communitySlug: communitySlug.value })
          .optimistic((posts) =>
            (posts ?? []).map((p) =>
              p.id === postId ? { ...p, score: p.score + value } : p
            )
          )
      )
    } catch (err) {
      voteError.value =
        err instanceof Error ? err.message : "Vote failed. Try again."
    }
  }

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

      <Show when={voteError}>
        <p className="text-sm text-rose-300" role="alert">
          {voteError}
        </p>
      </Show>

      <Derive
        from={feed}
        fallback={
          <p className="text-slate-400" data-testid="feed-fallback">
            Loading feed…
          </p>
        }
      >
        {(posts) => {
          if (posts.length === 0) {
            return (
              <p className="text-slate-400" data-testid="feed-empty">
                No posts yet.
              </p>
            )
          }
          return (
            <ul className="space-y-3" data-testid="feed-list">
              {posts.map((post) => (
                <li
                  key={post.id}
                  data-testid={`feed-post-${post.id}`}
                  className="rounded-lg border p-4"
                >
                  <div className="flex gap-3">
                    <div className="flex flex-col items-center gap-1 text-slate-400">
                      <button
                        type="button"
                        data-testid={`vote-up-${post.id}`}
                        className="text-lg leading-none hover:text-orange-400"
                        onclick={() => onVote(post.id, 1)}
                        aria-label="Upvote"
                      >
                        ▲
                      </button>
                      <span
                        className="text-sm font-medium text-slate-200"
                        data-testid={`vote-score-${post.id}`}
                      >
                        {post.score}
                      </span>
                      <button
                        type="button"
                        data-testid={`vote-down-${post.id}`}
                        className="text-lg leading-none hover:text-indigo-400"
                        onclick={() => onVote(post.id, -1)}
                        aria-label="Downvote"
                      >
                        ▼
                      </button>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-slate-500">
                        <Link
                          to="/threadboard/c/[slug]"
                          params={{ slug: post.communitySlug }}
                          className="font-medium text-cyan-300 hover:underline"
                        >
                          c/{post.communitySlug}
                        </Link>
                        <span> · u/{post.authorUsername}</span>
                      </p>
                      <h3 className="mt-1 text-lg font-semibold">
                        <Link
                          to="/threadboard/p/[id]"
                          params={{ id: post.id }}
                          className="hover:text-orange-200"
                          data-testid={`feed-post-title-${post.id}`}
                        >
                          {post.title}
                        </Link>
                      </h3>
                      <p className="mt-2 line-clamp-3 text-sm text-slate-400">
                        {post.body}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )
        }}
      </Derive>
    </div>
  )
}

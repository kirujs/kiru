import { Derive, resource, signal } from "kiru"
import { useRequestContext } from "kiru/router"
import type { MutationResult } from "kiru/remote"
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

function formatRelative(ms: number) {
  const hours = Math.floor((Date.now() - ms) / 3_600_000)
  if (hours < 1) return "just now"
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export function FeedList(props: FeedListProps) {
  const ctx = useRequestContext()
  const sort = signal<FeedSort>("hot")
  const communitySlug = signal(props.communitySlug)
  const voteError = signal<string | null>(null)
  const feed = resource({
    source: { sort, communitySlug },
    load: getFeed,
    defaultState: [],
  })

  async function onVote(postId: string, value: 1 | -1) {
    if (!ctx.user) {
      voteError.value = null
      return
    }
    voteError.value = null
    try {
      const pending = votePost({
        targetType: "post",
        targetId: postId,
        value,
      }) as MutationResult<{ score: number }>
      await pending.updates(
        getFeed.key({ sort: sort.value, communitySlug: communitySlug.value }),
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
    <div className="space-y-4">
      <div className="flex gap-2">
        <button
          type="button"
          className={`rounded-full px-3 py-1 text-sm ${
            sort.value === "hot"
              ? "bg-orange-600 text-white"
              : "border border-slate-700 text-slate-300"
          }`}
          onclick={() => {
            sort.value = "hot"
          }}
        >
          Hot
        </button>
        <button
          type="button"
          className={`rounded-full px-3 py-1 text-sm ${
            sort.value === "new"
              ? "bg-orange-600 text-white"
              : "border border-slate-700 text-slate-300"
          }`}
          onclick={() => {
            sort.value = "new"
          }}
        >
          New
        </button>
      </div>

      {!ctx.user ? (
        <p className="text-sm text-slate-400">
          <Link to="/login" className="text-cyan-300 hover:underline">
            Sign in
          </Link>{" "}
          to vote on posts.
        </p>
      ) : voteError.value ? (
        <p className="text-sm text-rose-300" role="alert">
          {voteError.value}
        </p>
      ) : null}

      <Derive
        from={feed}
        fallback={<p className="text-slate-400">Loading feed…</p>}
      >
        {(posts) => {
          const list = posts as FeedPost[]
          return list.length === 0 ? (
            <p className="text-slate-400">No posts yet.</p>
          ) : (
            <ul className="space-y-3">
              {list.map((post) => (
                <li
                  key={post.id}
                  className="rounded-lg border border-slate-800 bg-slate-950/50 p-4"
                >
                  <div className="flex gap-3">
                    <div className="flex flex-col items-center gap-1 text-slate-400">
                      <button
                        type="button"
                        className="text-lg leading-none hover:text-orange-400"
                        onclick={() => onVote(post.id, 1)}
                        aria-label="Upvote"
                      >
                        ▲
                      </button>
                      <span className="text-sm font-medium text-slate-200">
                        {post.score}
                      </span>
                      <button
                        type="button"
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
                          to="/c/[slug]"
                          params={{ slug: post.communitySlug }}
                          className="font-medium text-cyan-300 hover:underline"
                        >
                          c/{post.communitySlug}
                        </Link>
                        <span> · </span>
                        <Link
                          to="/u/[username]"
                          params={{ username: post.authorUsername }}
                          className="hover:underline"
                        >
                          u/{post.authorUsername}
                        </Link>
                        <span> · {formatRelative(post.createdAt)}</span>
                      </p>
                      <h3 className="mt-1 text-lg font-semibold text-slate-100">
                        <Link
                          to="/p/[id]"
                          params={{ id: post.id }}
                          className="hover:text-orange-200"
                        >
                          {post.title}
                        </Link>
                      </h3>
                      <p className="mt-2 line-clamp-3 text-sm text-slate-400">
                        {post.body}
                      </p>
                      <p className="mt-2 text-xs text-slate-500">
                        {post.commentCount} comment
                        {post.commentCount === 1 ? "" : "s"}
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

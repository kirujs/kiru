import { Derive, effect, resource, signal } from "kiru"
import { createFormController } from "kiru/remote"
import { defineHeadContent, Link, serverLoader, useRequestContext, type PageProps } from "kiru/router"
import { addComment, getPost, type PostDetail } from "../../feed.remote.js"

export const load = serverLoader(async (ctx) => {
  const id = ctx.params.id
  if (!id) throw new Error("Missing post id")
  const post = await getPost({ id })
  return { post }
})

export const head = defineHeadContent<typeof load>(async (ctx) => {
  const page = await ctx.loader()
  if (page.error || !page.data) {
    return { title: "Post — Threadboard" }
  }
  const { post } = page.data
  return {
    title: `${post.title} — Threadboard`,
    description: post.body.slice(0, 160),
  }
})

export default function PostPage({ data, error }: PageProps<typeof load>) {
  const ctx = useRequestContext()
  const postId = data?.post.id ?? ""
  const idSignal = signal(postId)
  const post = resource({
    source: { id: idSignal },
    load: getPost,
  })
  const commentForm = createFormController(addComment)

  effect([commentForm.result], (res) => {
    if (res?.ok) {
      post.refetch()
      commentForm.result.value = null
    }
  })

  if (error) {
    return (
      <p className="text-rose-300" role="alert">
        {error.message}
      </p>
    )
  }

  return () => (
    <Derive from={post} fallback={<p className="text-slate-400">Loading post…</p>}>
      {(detail) => {
        const p = detail as PostDetail
        return (
          <article className="space-y-6">
            <div>
              <p className="text-xs text-slate-500">
                <Link
                  to="/c/[slug]"
                  params={{ slug: p.communitySlug }}
                  className="text-cyan-300 hover:underline"
                >
                  c/{p.communitySlug}
                </Link>
                <span> · </span>
                <Link
                  to="/u/[username]"
                  params={{ username: p.authorUsername }}
                  className="hover:underline"
                >
                  u/{p.authorUsername}
                </Link>
                <span> · score {p.score}</span>
              </p>
              <h1 className="mt-2 text-2xl font-bold text-slate-100">{p.title}</h1>
              <p className="mt-4 whitespace-pre-wrap text-slate-300">{p.body}</p>
            </div>

            <section className="space-y-4">
              <h2 className="text-lg font-semibold text-slate-200">
                Comments ({p.comments.length})
              </h2>
              <ul className="space-y-3">
                {p.comments.map((c) => (
                  <li
                    key={c.id}
                    className="rounded-lg border border-slate-800 bg-slate-950/40 p-3"
                  >
                    <p className="text-xs text-slate-500">
                      u/{c.authorUsername} · score {c.score}
                    </p>
                    <p className="mt-1 text-sm text-slate-300">{c.body}</p>
                  </li>
                ))}
              </ul>

              {ctx.user ? (
                <form
                  className="space-y-2 rounded-lg border border-slate-800 p-4"
                  action={commentForm.action}
                  method={commentForm.method}
                  onsubmit={commentForm.onsubmit}
                >
                  <input type="hidden" name="postId" value={p.id} />
                  <label className="block text-sm text-slate-300">
                    Add a comment
                    <textarea
                      name="body"
                      rows={3}
                      className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
                    />
                  </label>
                  {commentForm.error.value ? (
                    <p className="text-sm text-rose-300">{commentForm.error.value}</p>
                  ) : null}
                  <button
                    type="submit"
                    className="rounded bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-500"
                    disabled={commentForm.isPending.value}
                  >
                    {commentForm.isPending.value ? "Posting…" : "Post comment"}
                  </button>
                </form>
              ) : (
                <p className="text-sm text-slate-400">
                  <Link to="/login" className="text-cyan-300 hover:underline">
                    Sign in
                  </Link>{" "}
                  to comment.
                </p>
              )}
            </section>
          </article>
        )
      }}
    </Derive>
  )
}

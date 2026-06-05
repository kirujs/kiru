import { Derive, resource, signal } from "kiru"
import { Link } from "kiru/router"
import { getPost, type PostDetail } from "../feed.remote.js"

export function PostModal(props: {
  postId: string
  title: string
  onClose: () => void
}) {
  const idSignal = signal(props.postId)
  const post = resource({
    source: { id: idSignal },
    load: getPost,
  })

  return () => (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 p-4 pt-16"
      onclick={(e) => {
        if (e.target === e.currentTarget) props.onClose()
      }}
    >
      <div className="max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-xl font-semibold text-slate-100">{props.title}</h2>
          <button
            type="button"
            className="text-slate-400 hover:text-white"
            onclick={props.onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <Derive from={post} fallback={<p className="mt-4 text-slate-400">Loading…</p>}>
          {(detail) => {
            const p = detail as PostDetail
            return (
            <div className="mt-4 space-y-4">
              <p className="text-xs text-slate-500">
                c/{p.communitySlug} · u/{p.authorUsername}
              </p>
              <p className="whitespace-pre-wrap text-slate-300">{p.body}</p>
              <Link
                to="/p/[id]"
                params={{ id: props.postId }}
                intercept={false}
                className="text-sm text-cyan-300 hover:underline"
              >
                Open full page
              </Link>
            </div>
            )
          }}
        </Derive>
      </div>
    </div>
  )
}

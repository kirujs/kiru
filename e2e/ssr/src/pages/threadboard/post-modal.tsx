import { Link } from "kiru/router"

export function PostModal({
  postId,
  title,
  onClose,
}: {
  postId: string
  title: string
  onClose: () => void
}) {
  return (
    <div data-testid="post-modal" className="rounded-lg border p-4">
      <h2>{title}</h2>
      <p className="text-sm text-slate-400">Post {postId}</p>
      <Link
        to="/threadboard/p/[id]"
        params={{ id: postId }}
        intercept={false}
        replace
        data-testid="post-open-full-page"
        className="text-sm text-cyan-300 hover:underline"
      >
        Open full page
      </Link>
      <button type="button" onclick={onClose}>
        Close
      </button>
    </div>
  )
}

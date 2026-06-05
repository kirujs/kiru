export function PostModal({
  postId,
  title,
  onClose,
}: {
  postId: string
  title: string
  onClose: () => void
}) {
  return () => (
    <div data-testid="post-modal" className="rounded-lg border p-4">
      <h2>{title}</h2>
      <p className="text-sm text-slate-400">Post {postId}</p>
      <button type="button" onclick={onClose}>
        Close
      </button>
    </div>
  )
}

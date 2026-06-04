export default function PhotoModal({
  photoId,
  title,
  onClose,
}: {
  photoId: string
  title: string
  onClose: () => void
}) {
  return () => (
    <div
      role="dialog"
      data-testid="photo-modal"
      data-photo-id={photoId}
      data-photo-title={title}
    >
      <p data-testid="photo-modal-title">{title}</p>
      <button type="button" data-testid="photo-modal-close" onclick={onClose}>
        Close
      </button>
    </div>
  )
}

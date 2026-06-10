export function LoginModal({ onClose }: { onClose: () => void }) {
  return (
    <div data-testid="login-modal" className="rounded-lg border p-4">
      <p>Login modal stub</p>
      <button type="button" onclick={onClose}>
        Close
      </button>
    </div>
  )
}

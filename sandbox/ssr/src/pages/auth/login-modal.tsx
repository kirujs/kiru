import { LoginForm } from "./login-form.js"

export function LoginModal(props: { onClose: () => void }) {
  return () => (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 p-4 pt-16"
      onclick={(e) => {
        if (e.target === e.currentTarget) props.onClose()
      }}
    >
      <div className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-xl font-semibold text-slate-100">Sign in</h2>
          <button
            type="button"
            className="text-slate-400 hover:text-white"
            onclick={props.onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <p className="mt-2 text-sm text-slate-400">
          Sign in without leaving the page you were on.
        </p>
        <div className="mt-4">
          <LoginForm onSuccess={props.onClose} />
        </div>
      </div>
    </div>
  )
}

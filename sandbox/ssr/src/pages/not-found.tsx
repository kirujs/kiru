export default function NotFoundPage() {
  return (
    <div className="space-y-3">
      <h2 className="text-xl font-semibold text-slate-100">Page not found</h2>
      <p className="text-slate-300">
        No route matches this URL in the SSR sandbox.
      </p>
      <p className="text-sm text-slate-400">
        Use the nav above or go back to{" "}
        <a href="/" className="text-cyan-300 hover:text-cyan-200">
          home
        </a>
        .
      </p>
    </div>
  )
}

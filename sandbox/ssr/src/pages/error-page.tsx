export default function ScopeErrorPage({ error }: { error: Error }) {
  return (
    <div className="space-y-3 rounded-lg border border-rose-500/40 bg-rose-950/30 p-4">
      <h2 className="text-lg font-semibold text-rose-200">Route error (scope)</h2>
      <p className="font-mono text-sm text-rose-100">{error.message}</p>
      <p className="text-sm text-slate-400">
        The matched route threw during SSR; the scope{" "}
        <code className="text-rose-200">error</code> module rendered inside the
        layout instead of a generic 500 page.
      </p>
    </div>
  )
}

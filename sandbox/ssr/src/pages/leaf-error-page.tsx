export default function LeafErrorPage({ error }: { error: Error }) {
  return (
    <div className="space-y-3 rounded-lg border border-amber-500/40 bg-amber-950/30 p-4">
      <h2 className="text-lg font-semibold text-amber-200">Route error (leaf)</h2>
      <p className="font-mono text-sm text-amber-100">{error.message}</p>
      <p className="text-sm text-slate-400">
        This route defines its own <code className="text-amber-200">error</code>{" "}
        module, which takes precedence over the scope handler.
      </p>
    </div>
  )
}

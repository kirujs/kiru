export default function AboutPage() {
  return (
    <div className="space-y-3">
      <h2 className="text-xl font-semibold text-slate-100">About</h2>
      <p className="text-slate-300">SSR about page.</p>
      <p className="text-sm text-slate-400">
        This route is rendered on the server and hydrated on the client.
      </p>
    </div>
  )
}

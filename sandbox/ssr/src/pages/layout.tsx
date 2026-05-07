import { signal } from "kiru"
import { Link, onBeforeRouteEnter, onBeforeRouteUpdate } from "kiru/router"

const guardEvents = signal<string[]>([])

export default function Layout() {
  onBeforeRouteEnter((to) => {
    guardEvents.value = [...guardEvents.peek(), `enter:${to.pathname}`]
  })
  onBeforeRouteUpdate((to, from) => {
    guardEvents.value = [
      ...guardEvents.peek(),
      `update:${from?.pathname ?? "none"}->${to.pathname}`,
    ]
  })

  return ({ children }: { children: JSX.Children }) => (
    <main className="min-h-screen bg-slate-950 p-6 text-slate-100 md:p-10">
      <div className="mx-auto max-w-3xl rounded-2xl border border-slate-800 bg-slate-900/70 p-6 shadow-2xl shadow-slate-950/40 md:p-8">
        <p className="text-xs font-semibold uppercase tracking-wider text-cyan-300">
          Server Side Rendering
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">
          Kiru SSR Sandbox
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          Tailwind CSS v4 styling with router guard event visibility.
        </p>
        <nav className="mt-6 flex flex-wrap gap-2">
          <Link
            to="/"
            className="rounded-full border border-slate-700 px-3 py-1 text-sm font-medium text-slate-200 hover:border-cyan-400 hover:text-cyan-200"
          >
            Home
          </Link>
          <Link
            to="/about"
            className="rounded-full border border-slate-700 px-3 py-1 text-sm font-medium text-slate-200 hover:border-cyan-400 hover:text-cyan-200"
          >
            About
          </Link>
          <Link
            to="/users/42"
            className="rounded-full border border-slate-700 px-3 py-1 text-sm font-medium text-slate-200 hover:border-cyan-400 hover:text-cyan-200"
          >
            User 42
          </Link>
          <Link
            to="/users/0"
            className="rounded-full border border-slate-700 px-3 py-1 text-sm font-medium text-slate-200 hover:border-cyan-400 hover:text-cyan-200"
          >
            User 0 (guarded)
          </Link>
        </nav>
        <p
          data-testid="guard-events"
          className="mt-6 rounded-lg border border-slate-800 bg-slate-950/60 p-3 font-mono text-xs text-slate-300"
        >
          Guard events: {() => guardEvents.value.join(", ")}
        </p>
        <section className="mt-6 rounded-xl border border-slate-800 bg-slate-900/60 p-4 md:p-6">
          {children}
        </section>
      </div>
    </main>
  )
}

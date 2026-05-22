import { signal } from "kiru"
import {
  Link,
  onAfterRouteEnter,
  onBeforeRouteUpdate,
  useRequestContext,
} from "kiru/router"

const guardEvents = signal<string[]>([])

export default function Layout() {
  const ctx = useRequestContext()

  onAfterRouteEnter((to) => {
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
          Auth, account, and todos — remote actions with real cookies.
        </p>

        {ctx.user ? (
          <p className="mt-3 text-sm text-slate-300">
            Signed in as{" "}
            <span className="font-mono text-cyan-200">{ctx.user.name}</span>
            <span className="text-slate-500"> · {ctx.user.email}</span>
          </p>
        ) : (
          <p className="mt-3 text-sm text-slate-500">Not signed in</p>
        )}

        <nav className="mt-6 flex flex-wrap gap-2">
          <Link
            to="/"
            className="rounded-full border border-slate-700 px-3 py-1 text-sm font-medium text-slate-200 hover:border-cyan-400 hover:text-cyan-200"
          >
            Home
          </Link>
          {ctx.user ? (
            <>
              <Link
                to="/todos"
                className="rounded-full border border-cyan-700 bg-cyan-950/80 px-3 py-1 text-sm font-medium text-cyan-100 hover:bg-cyan-900"
              >
                Todos
              </Link>
              <Link
                to="/account"
                className="rounded-full border border-slate-700 px-3 py-1 text-sm font-medium text-slate-200 hover:border-cyan-400 hover:text-cyan-200"
              >
                Account
              </Link>
            </>
          ) : (
            <Link
              to="/login"
              className="rounded-full border border-cyan-700 bg-cyan-950/80 px-3 py-1 text-sm font-medium text-cyan-100 hover:bg-cyan-900"
            >
              Sign in
            </Link>
          )}
          <Link
            to="/about"
            className="rounded-full border border-slate-700 px-3 py-1 text-sm font-medium text-slate-200 hover:border-cyan-400 hover:text-cyan-200"
          >
            About
          </Link>
          <Link
            to="/docs"
            className="rounded-full border border-slate-700 px-3 py-1 text-sm font-medium text-slate-200 hover:border-cyan-400 hover:text-cyan-200"
          >
            Docs (static)
          </Link>
          <Link
            to="/seo"
            className="rounded-full border border-cyan-600 bg-cyan-950 px-3 py-1 text-sm font-medium text-cyan-200 hover:bg-cyan-900"
          >
            SEO
          </Link>
          <Link
            to="/users/42"
            className="rounded-full border border-slate-700 px-3 py-1 text-sm font-medium text-slate-200 hover:border-cyan-400 hover:text-cyan-200"
          >
            User 42
          </Link>
          <Link
            to="/demo-loader"
            className="rounded-full border border-slate-700 px-3 py-1 text-sm font-medium text-slate-200 hover:border-cyan-400 hover:text-cyan-200"
          >
            Route demo
          </Link>
          <Link
            to="/break-ssr"
            className="rounded-full border border-rose-800/80 px-3 py-1 text-sm font-medium text-rose-200 hover:border-rose-400"
          >
            Break SSR
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

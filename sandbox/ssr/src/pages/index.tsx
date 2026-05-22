import { signal } from "kiru"
import { Link, useRequestContext } from "kiru/router"
import { getSandboxServerEcho } from "../index.actions.js"

export default function HomePage() {
  const ctx = useRequestContext()
  const echo = signal<string | null>(null)

  return () => (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-slate-100">SSR sandbox</h2>
      <p className="text-slate-300">
        {ctx.user ? (
          <>
            Welcome back,{" "}
            <span className="font-mono text-cyan-200">{ctx.user.name}</span>.
            Manage your{" "}
            <Link to="/todos" className="text-cyan-300 hover:underline">
              todos
            </Link>{" "}
            or update your{" "}
            <Link to="/account" className="text-cyan-300 hover:underline">
              account
            </Link>
            .
          </>
        ) : (
          <>
            Sign in to try cookie sessions, profile updates, and todo CRUD backed
            by remote actions.
          </>
        )}
      </p>

      <ul className="list-inside list-disc space-y-1 text-sm text-slate-400">
        <li>
          <strong className="text-slate-200">Login / logout</strong> — form
          actions set <code className="text-cyan-200">Set-Cookie</code> on the
          server
        </li>
        <li>
          <strong className="text-slate-200">Account</strong> — update name and
          email; <code className="text-cyan-200">actionResult</code> refreshes{" "}
          <code className="text-cyan-200">x-kiru-token</code>
        </li>
        <li>
          <strong className="text-slate-200">Todos</strong> — add (form), toggle /
          edit / delete (JSON)
        </li>
      </ul>

      <div className="flex flex-wrap gap-2">
        {ctx.user ? (
          <>
            <Link
              to="/todos"
              className="rounded-lg bg-cyan-800 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-700"
            >
              Open todos
            </Link>
            <Link
              to="/account"
              className="rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-200 hover:border-cyan-500"
            >
              Account settings
            </Link>
          </>
        ) : (
          <Link
            to="/login"
            className="rounded-lg bg-cyan-800 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-700"
          >
            Sign in
          </Link>
        )}
      </div>

      <button
        type="button"
        className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:border-cyan-500"
        onclick={async () => {
          echo.value = await getSandboxServerEcho()
        }}
      >
        Call JSON action (GET echo)
      </button>
      {echo.value ? (
        <p className="font-mono text-xs text-cyan-200">{echo}</p>
      ) : null}
    </div>
  )
}

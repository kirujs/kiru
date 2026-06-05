import { createFormController } from "kiru/remote"
import { Link } from "kiru/router"
import { DUMMY_ACCOUNTS } from "../server/auth.js"
import { login } from "./login.remote.js"

export default function LoginPage() {
  const form = createFormController(login)
  const accounts = Object.keys(DUMMY_ACCOUNTS)

  return () => (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-slate-100">Sign in</h2>
      <p className="text-sm text-slate-400">
        Credentials are checked on the server. On success the login action sets an
        HttpOnly session cookie and redirects to your todos.
      </p>

      <form
        className="space-y-3 rounded-lg border border-slate-800 bg-slate-950/50 p-4"
        action={form.action}
        method={form.method}
        onsubmit={form.onsubmit}
      >
        <label className="block text-sm text-slate-300">
          Username
          <input
            className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
            name="username"
            type="text"
            autocomplete="username"
            placeholder="demo"
          />
        </label>
        <p className="text-xs text-rose-300">
          {form.result.value?.ok === false
            ? (form.result.value.errors?.username ?? "")
            : ""}
        </p>

        <label className="block text-sm text-slate-300">
          Password
          <input
            className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
            name="password"
            type="password"
            autocomplete="current-password"
          />
        </label>
        <p className="text-xs text-rose-300">
          {form.result.value?.ok === false
            ? (form.result.value.errors?.password ?? "")
            : ""}
        </p>

        {form.error.value ? (
          <p className="text-sm text-rose-300" role="alert">
            {form.error.value}
          </p>
        ) : null}

        <button
          type="submit"
          className="rounded-lg bg-cyan-700 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-600 disabled:opacity-50"
          disabled={form.isPending.value}
        >
          {form.isPending.value ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <p className="text-xs text-slate-500">
        Demo users: {accounts.join(", ")} (password matches username).
      </p>

      <p className="text-sm text-slate-400">
        <Link to="/" className="text-cyan-300 hover:underline">
          ← Back home
        </Link>
      </p>
    </div>
  )
}

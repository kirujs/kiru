import { Derive, effect, resource } from "kiru"
import { createFormController } from "kiru/remote"
import { Link, useRequestContext } from "kiru/router"
import { getProfile, updateProfile } from "./account.actions.js"
import { logoutForm } from "./login.actions.js"

export default function AccountPage() {
  const ctx = useRequestContext()
  const profile = resource(() => getProfile())
  const form = createFormController(updateProfile)
  const logout = createFormController(logoutForm)

  effect([form.result], (res) => {
    if (!res || res.ok !== true) return
    profile.refetch()
    form.result.value = null
  })

  return () => (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-xl font-semibold text-slate-100">Account</h2>
          <p className="text-sm text-slate-400">
            User id{" "}
            <span className="font-mono text-cyan-200">{ctx.user?.id}</span>
          </p>
        </div>
        <form
          action={logout.action}
          method={logout.method}
          onsubmit={logout.onsubmit}
        >
          <button
            type="submit"
            className="rounded-full border border-slate-600 px-3 py-1 text-sm text-slate-300 hover:border-rose-500 hover:text-rose-200"
          >
            Sign out
          </button>
        </form>
      </div>

      <p className="rounded-lg border border-slate-800 bg-slate-950/40 p-3 text-xs text-slate-400">
        Profile updates use a{" "}
        <strong className="text-slate-200">form action</strong> with mutating{" "}
        <code className="text-cyan-200">context</code> so the server returns a
        fresh <code className="text-cyan-200">x-kiru-token</code> without a full
        page redirect.
      </p>

      <Derive
        from={profile}
        fallback={<p className="text-slate-400">Loading profile…</p>}
      >
        {(user) => (
          <form
            className="space-y-3 rounded-lg border border-slate-800 bg-slate-950/50 p-4"
            action={form.action}
            method={form.method}
            onsubmit={form.onsubmit}
          >
            <label className="block text-sm text-slate-300">
              Display name
              <input
                className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
                name="name"
                type="text"
                value={user.name}
                autocomplete="name"
              />
            </label>
            <label className="block text-sm text-slate-300">
              Email
              <input
                className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
                name="email"
                type="email"
                value={user.email}
                autocomplete="email"
              />
            </label>
            <button
              type="submit"
              className="rounded-lg bg-cyan-700 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-600 disabled:opacity-50"
              disabled={form.isPending.value}
            >
              {form.isPending.value ? "Saving…" : "Save profile"}
            </button>
            {form.result.value?.ok === true ? (
              <p className="text-xs text-emerald-300">Profile saved.</p>
            ) : null}
          </form>
        )}
      </Derive>

      <p className="flex flex-wrap gap-3 text-sm">
        <Link to="/todos" className="text-cyan-300 hover:underline">
          ← Todos
        </Link>
        <Link to="/" className="text-slate-400 hover:underline">
          Home
        </Link>
      </p>
    </div>
  )
}

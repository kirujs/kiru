import { Derive, effect, resource } from "kiru"
import { createFormController } from "kiru/remote"
import { Link, useRequestContext } from "kiru/router"
import { getProfile, updateProfile } from "../auth.remote.js"

export default function SettingsPage() {
  const ctx = useRequestContext()
  const profile = resource(() => getProfile())
  const form = createFormController(updateProfile)

  effect([form.result], (res) => {
    if (!res || res.ok !== true) return
    profile.refetch()
    form.result.value = null
  })

  return () => (
    <div className="mx-auto max-w-lg space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-slate-100">Settings</h2>
        <p className="text-sm text-slate-400">
          Signed in as{" "}
          <span className="font-mono text-cyan-200">u/{ctx.user?.username}</span>
        </p>
      </div>

      <Derive from={profile} fallback={<p className="text-slate-400">Loading profile…</p>}>
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
                name="name"
                type="text"
                value={user.name}
                className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
              />
            </label>
            <label className="block text-sm text-slate-300">
              Email
              <input
                name="email"
                type="email"
                value={user.email}
                className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
              />
            </label>
            <label className="block text-sm text-slate-300">
              Bio
              <textarea
                name="bio"
                rows={3}
                value={user.bio}
                className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
              />
            </label>
            <label className="block text-sm text-slate-300">
              Avatar URL
              <input
                name="avatarUrl"
                type="url"
                value={user.avatarUrl}
                placeholder="https://…"
                className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
              />
            </label>
            {form.error.value ? (
              <p className="text-sm text-rose-300">{form.error.value}</p>
            ) : null}
            <button
              type="submit"
              className="rounded bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-500"
              disabled={form.isPending.value}
            >
              {form.isPending.value ? "Saving…" : "Save profile"}
            </button>
          </form>
        )}
      </Derive>

      <p className="text-sm text-slate-400">
        <Link to="/" className="text-cyan-300 hover:underline">
          ← Back home
        </Link>
      </p>
    </div>
  )
}

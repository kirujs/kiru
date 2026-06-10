import { effect, Show } from "kiru"
import { createFormController } from "kiru/remote"
import { Link, PageProps, serverLoader, useRouter } from "kiru/router"
import { getProfile, updateProfile } from "../auth.remote.js"

export const load = serverLoader(async () => {
  const profile = await getProfile()
  return { profile }
})

export default function SettingsPage() {
  const router = useRouter()
  const form = createFormController(updateProfile)

  effect([form.result], (res) => {
    if (!res || res.ok !== true) return
    router.invalidate({ current: true })
    form.result.value = null
  })

  return ({ data, error }: PageProps<typeof load>) => {
    if (error) {
      return <p className="text-rose-300">{error.message}</p>
    }

    const user = data.profile
    return (
      <>
        <div className="mx-auto max-w-lg space-y-5">
          <div>
            <h2 className="text-xl font-semibold text-slate-100">Settings</h2>
            <p className="text-sm text-slate-400">
              Signed in as{" "}
              <span className="font-mono text-cyan-200">u/{user.username}</span>
            </p>
          </div>

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
            <Show when={form.error}>
              <p className="text-sm text-rose-300">{form.error}</p>
            </Show>
            <button
              type="submit"
              className="rounded bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-500"
              disabled={form.isPending.value}
            >
              {() => (form.isPending.value ? "Saving…" : "Save profile")}
            </button>
          </form>
        </div>

        <p className="text-sm text-slate-400">
          <Link to="/" className="text-cyan-300 hover:underline">
            ← Back home
          </Link>
        </p>
      </>
    )
  }
}

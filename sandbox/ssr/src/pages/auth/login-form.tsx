import { effect } from "kiru"
import { createFormController } from "kiru/remote"
import { useRouter } from "kiru/router"
import { listDemoUsernames } from "../../server/auth.js"
import { login } from "../auth.remote.js"

export function LoginForm(props: { onSuccess?: () => void }) {
  const router = useRouter()
  const form = createFormController(login)
  const accounts = listDemoUsernames()

  effect([form.result], (res) => {
    if (!res || res.ok !== true) return
    router.requestContext.value = {
      ...router.requestContext.peek(),
      user: res.user ?? null,
    }
    props.onSuccess?.()
    form.result.value = null
  })

  return () => (
    <form
      className="space-y-3"
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

      {form.error.value ? (
        <p className="text-sm text-rose-300" role="alert">
          {form.error.value}
        </p>
      ) : null}

      <button
        type="submit"
        className="w-full rounded-lg bg-orange-600 py-2 text-sm font-medium text-white hover:bg-orange-500 disabled:opacity-50"
        disabled={form.isPending.value}
      >
        {form.isPending.value ? "Signing in…" : "Sign in"}
      </button>

      <p className="text-xs text-slate-500">
        Demo users: {accounts.join(", ")} (password matches username).
      </p>
    </form>
  )
}

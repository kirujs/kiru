import { signal } from "kiru"
import { useRequestContext } from "kiru/router"
import { getSandboxServerEcho } from "../index.actions"

export default function HomePage() {
  const { user } = useRequestContext()
  const remote = signal("")

  return (
    <div className="space-y-3">
      <h2 className="text-xl font-semibold text-slate-100">Home</h2>
      <p className="text-slate-300">
        This page is server-rendered by `createRenderer`.
      </p>
      <p className="text-slate-300">
        User:
        <span className="ml-2 rounded-md bg-cyan-400/20 px-2 py-1 font-medium text-cyan-200">
          {user?.name ?? "n/a"}
        </span>
      </p>
      <p className="text-slate-400 text-sm">
        Remote actions use <code className="text-cyan-200">allowedOrigins</code> in dev
        (see <code className="text-cyan-200">server.ts</code>).
      </p>
      <button
        type="button"
        className="rounded-lg bg-cyan-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-cyan-500"
        onclick={async () => {
          remote.value = await getSandboxServerEcho()
        }}
      >
        Call remote action
      </button>
      <p className="font-mono text-sm text-emerald-200">{remote}</p>
    </div>
  )
}

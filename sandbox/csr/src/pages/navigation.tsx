import { signal } from "kiru"
import { useMatches, useRouter } from "kiru/router"

export default function NavigationPage() {
  const router = useRouter()
  const lastNav = signal("")
  const getMatches = useMatches()

  return () => (
    <div className="space-y-3 text-slate-700">
      <p>
        Uses <code className="rounded bg-slate-100 px-1">await router.navigate()</code>,{" "}
        <code className="rounded bg-slate-100 px-1">useMatches()</code>, and{" "}
        <code className="rounded bg-slate-100 px-1">pendingTo</code>.
      </p>
      <button
        type="button"
        className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
        onclick={async () => {
          const r = await router.navigate("/about")
          lastNav.value = r.status
        }}
      >
        Programmatic navigate to About
      </button>
      <p>
        Last result: <strong>{() => lastNav.value}</strong>
      </p>
      <p>
        Active match depth:{" "}
        <strong>{() => String(getMatches().length)}</strong>
      </p>
      <p>
        Pending target: <strong>{() => router.pendingTo.value ?? "—"}</strong>
      </p>
    </div>
  )
}

import { signal } from "kiru"
import { useMatches, useRouter } from "kiru/router"

function formatSnapshot(pathname: string, params: Record<string, string>) {
  const keys = Object.keys(params)
  if (!keys.length) return pathname
  return `${pathname} (${keys.map((k) => `${k}=${params[k]}`).join(", ")})`
}

export default function NavigationPage() {
  const router = useRouter()
  const lastNav = signal("")
  const getMatches = useMatches()

  return () => {
    const nav = router.currentNavigation()
    return (
      <div className="space-y-3 text-slate-700">
        <p>
          Uses{" "}
          <code className="rounded bg-slate-100 px-1">
            await router.navigate()
          </code>
          , <code className="rounded bg-slate-100 px-1">useMatches()</code>,{" "}
          <code className="rounded bg-slate-100 px-1">isNavigating</code>, and{" "}
          <code className="rounded bg-slate-100 px-1">currentNavigation</code>.
        </p>
        <button
          type="button"
          className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
          onclick={async () => {
            const r = await router.navigate("/about")
            lastNav.set(r.status)
          }}
        >
          Programmatic navigate to About
        </button>
        <p>
          Last result: <strong>{() => lastNav()}</strong>
        </p>
        <p>
          Active match depth:{" "}
          <strong>{() => String(getMatches().length)}</strong>
        </p>
        <p>
          Navigating:{" "}
          <strong>{() => (router.isNavigating() ? "yes" : "no")}</strong>
        </p>
        <p>
          From:{" "}
          <strong>
            {() =>
              nav?.from
                ? formatSnapshot(nav.from.pathname, nav.from.params)
                : "—"
            }
          </strong>
        </p>
        <p>
          To:{" "}
          <strong>
            {() =>
              nav?.to ? formatSnapshot(nav.to.pathname, nav.to.params) : "—"
            }
          </strong>
        </p>
      </div>
    )
  }
}

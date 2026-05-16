import { signal } from "kiru"
import { useMatches, useRouter } from "kiru/router"

declare global {
  interface Window {
    __KIRU_NAV_RESULT__?: string
    __KIRU_NAV__?: {
      isNavigating: boolean
      from: string
      to: string
    }
  }
}

function formatSnapshot(pathname: string, params: Record<string, string>) {
  const keys = Object.keys(params)
  if (!keys.length) return pathname
  return `${pathname}?${keys.map((k) => `${k}=${params[k]}`).join("&")}`
}

export default function NavigationDemoPage() {
  const router = useRouter()
  const lastNav = signal("")
  const getMatches = useMatches()

  const syncNavProbe = () => {
    const nav = router.currentNavigation.value
    window.__KIRU_NAV__ = {
      isNavigating: router.isNavigating.value,
      from: nav?.from ? formatSnapshot(nav.from.pathname, nav.from.params) : "",
      to: nav?.to ? formatSnapshot(nav.to.pathname, nav.to.params) : "",
    }
  }

  return () => {
    syncNavProbe()
    return (
      <div>
        <h2>Navigation demo</h2>
        <button
          type="button"
          data-testid="nav-programmatic"
          onclick={async () => {
            const r = await router.navigate("/about")
            lastNav.value = r.status
            window.__KIRU_NAV_RESULT__ = r.status
          }}
        >
          Programmatic navigate to About
        </button>
        <button
          type="button"
          data-testid="nav-slow"
          onclick={async () => {
            await router.navigate("/slow-target")
          }}
        >
          Navigate to slow route
        </button>
        <p data-testid="nav-result">{() => lastNav.value}</p>
        <p data-testid="match-depth">{() => String(getMatches().length)}</p>
        <p data-testid="nav-in-progress">
          {() => (router.isNavigating.value ? "yes" : "no")}
        </p>
        <p data-testid="nav-from">
          {() => {
            const from = router.currentNavigation.value?.from
            return from ? formatSnapshot(from.pathname, from.params) : ""
          }}
        </p>
        <p data-testid="nav-to">
          {() => {
            const to = router.currentNavigation.value?.to
            return to ? formatSnapshot(to.pathname, to.params) : ""
          }}
        </p>
      </div>
    )
  }
}

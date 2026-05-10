import { signal } from "kiru"
import { useMatches, useRouter } from "kiru/router"

declare global {
  interface Window {
    __KIRU_NAV_RESULT__?: string
  }
}

export default function NavigationDemoPage() {
  const router = useRouter()
  const lastNav = signal("")
  const getMatches = useMatches()

  return () => (
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
      <p data-testid="nav-result">{() => lastNav.value}</p>
      <p data-testid="match-depth">{() => String(getMatches().length)}</p>
      <p data-testid="pending-to">{() => router.pendingTo.value ?? ""}</p>
    </div>
  )
}

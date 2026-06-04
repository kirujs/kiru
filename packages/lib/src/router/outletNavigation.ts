import type { Signal } from "../signals/base.js"
import type {
  CurrentNavigation,
  RouteInterceptState,
  RouteMatch,
} from "./types.js"

/** Router signals used to decide when a committed client navigation has finished. */
export type ClientNavigationEndRouter = {
  pathname: Signal<string>
  match: Signal<RouteMatch | null>
  currentNavigation: Signal<CurrentNavigation | null>
  isNavigating: Signal<boolean>
  interceptState?: Signal<RouteInterceptState | null>
}

export function canEndClientNavigation(
  router: ClientNavigationEndRouter
): boolean {
  const nav = router.currentNavigation.peek()
  if (!nav?.to) return true
  if (router.pathname.peek() !== nav.to.pathname) return false
  const intercept = router.interceptState?.peek()
  if (intercept) {
    return (
      JSON.stringify(intercept.targetMatch.params) ===
      JSON.stringify(nav.to.params)
    )
  }
  const m = router.match.peek()
  if (!m) return true
  return JSON.stringify(m.params) === JSON.stringify(nav.to.params)
}

export function tryClearClientNavigation(
  router: ClientNavigationEndRouter
): void {
  if (router.isNavigating.peek() && canEndClientNavigation(router)) {
    router.isNavigating.value = false
    router.currentNavigation.value = null
  }
}

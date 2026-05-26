import type { Signal } from "../signals/base.js"
import type { CurrentNavigation, RouteMatch } from "./types.js"

/** Router signals used to decide when a committed client navigation has finished. */
export type ClientNavigationEndRouter = {
  pathname: Signal<string>
  match: Signal<RouteMatch | null>
  currentNavigation: Signal<CurrentNavigation | null>
  isNavigating: Signal<boolean>
}

export function canEndClientNavigation(
  router: ClientNavigationEndRouter
): boolean {
  const nav = router.currentNavigation.peek()
  if (!nav?.to) return true
  if (router.pathname.peek() !== nav.to.pathname) return false
  const m = router.match.peek()
  if (!m) return true
  return JSON.stringify(m.params) === JSON.stringify(nav.to.params)
}

export function tryClearClientNavigation(
  router: ClientNavigationEndRouter
): void {
  if (router.isNavigating.peek() && canEndClientNavigation(router)) {
    router.isNavigating.set(false)
    router.currentNavigation.set(null)
  }
}

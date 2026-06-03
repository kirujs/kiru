import { onCleanup } from "../hooks/onCleanup.js"
import { useRouter } from "./csr.js"
import { getRouterRuntime } from "./routerRuntime.js"
import type { NavigationGuard } from "./types.js"

function currentRouteId(router: ReturnType<typeof useRouter>): string {
  return router.match.peek()?.route.id ?? "_"
}

export function onBeforeRouteLeave(guard: NavigationGuard): void {
  const router = useRouter()
  const unsub = getRouterRuntime(router).registerComponentGuard(
    "leave",
    guard,
    currentRouteId(router)
  )
  onCleanup(unsub)
}

export function onBeforeRouteUpdate(guard: NavigationGuard): void {
  const router = useRouter()
  const unsub = getRouterRuntime(router).registerComponentGuard(
    "update",
    guard,
    currentRouteId(router)
  )
  onCleanup(unsub)
}

/**
 * Runs after a navigation commits into the current route (side effects only).
 * Returning `false` or a redirect location is ignored; use leave guards or
 * route middleware to block or redirect before commit.
 */
export function onAfterRouteEnter(guard: NavigationGuard): void {
  const router = useRouter()
  const unsub = getRouterRuntime(router).registerComponentGuard("enter", guard)
  onCleanup(unsub)
}

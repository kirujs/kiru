import { onCleanup } from "../hooks/onCleanup.js"
import { useRouter } from "./csr.js"
import type { NavigationGuard } from "./types.js"

function currentRouteId(router: ReturnType<typeof useRouter>): string {
  return router.match.peek()?.route.id ?? "_"
}

export function onBeforeRouteLeave(guard: NavigationGuard): void {
  const router = useRouter()
  const register = router.__registerComponentGuard
  if (!register) return
  const unsub = register("leave", guard, currentRouteId(router))
  onCleanup(unsub)
}

export function onBeforeRouteUpdate(guard: NavigationGuard): void {
  const router = useRouter()
  const register = router.__registerComponentGuard
  if (!register) return
  const unsub = register("update", guard, currentRouteId(router))
  onCleanup(unsub)
}

/**
 * Runs after a navigation commits into the current route.
 */
export function onAfterRouteEnter(guard: NavigationGuard): void {
  const router = useRouter()
  const register = router.__registerComponentGuard
  if (!register) return
  const unsub = register("enter", guard)
  onCleanup(unsub)
}

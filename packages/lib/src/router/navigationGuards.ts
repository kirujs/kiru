import { onCleanup } from "../hooks/onCleanup.js"
import { useRouter } from "./csr.js"
import type { NavigationGuard } from "./types.js"

export function onBeforeRouteLeave(guard: NavigationGuard): void {
  const router = useRouter()
  const register = router.__registerComponentGuard
  if (!register) return
  const unsub = register("leave", guard)
  onCleanup(unsub)
}

export function onBeforeRouteUpdate(guard: NavigationGuard): void {
  const router = useRouter()
  const register = router.__registerComponentGuard
  if (!register) return
  const unsub = register("update", guard)
  onCleanup(unsub)
}

/**
 * Runs after a navigation commits into the current route.
 * (Unlike Vue's `beforeRouteEnter`, Kiru doesn't have a pre-activation component instance.)
 */
export function onBeforeRouteEnter(guard: NavigationGuard): void {
  const router = useRouter()
  const register = router.__registerComponentGuard
  if (!register) return
  const unsub = register("enter", guard)
  onCleanup(unsub)
}


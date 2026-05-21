import type { RouteScopeConfig } from "kiru/router"

export const config: RouteScopeConfig = {
  meta: { requiresAuth: true },
}

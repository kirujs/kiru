import type { RouteBuilder } from "kiru/router"
import { requireAuth } from "./e2eRouteMiddleware.js"
import ScopeContextPending from "./ScopeContextPending.tsx"

/** Context-gate demo route nodes (merge into an existing `defineRouteTree` scope). */
export function contextRouteChildren(r: RouteBuilder) {
  return [
    r.scope({
      contextStrategy: "none",
      static: true,
      children: [r.page("/context", () => import("./pages/home.tsx"))],
    }),
    r.scope({
      contextStrategy: "background",
      static: true,
      children: [
        r.page("/context/profile", () => import("./pages/profile.tsx")),
      ],
    }),
    r.scope({
      contextStrategy: "block",
      contextPendingFallback: () => <ScopeContextPending />,
      meta: { requiresAuth: true, unauthorizedRedirect: "/context/login" },
      middleware: [requireAuth],
      children: [r.page("/context/admin", () => import("./pages/admin.tsx"))],
    }),
    r.page("/context/login", {
      static: true,
      component: () => import("./pages/login.tsx"),
    }),
  ]
}

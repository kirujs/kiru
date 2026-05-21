import { createRoute, createRouteScope, type RouteTreeChild } from "kiru/router"
import { requireAuth } from "./e2eRouteMiddleware.js"
import ScopeContextPending from "./ScopeContextPending.tsx"

/** Context-gate demo route nodes (merge into `createRouteTree` children). */
export function contextRouteChildren(): RouteTreeChild[] {
  return [
    createRouteScope({
      contextStrategy: "none",
      static: true,
      children: [createRoute("/context", () => import("./pages/home.tsx"))],
    }),
    createRouteScope({
      contextStrategy: "background",
      static: true,
      children: [
        createRoute("/context/profile", () => import("./pages/profile.tsx")),
      ],
    }),
    createRouteScope({
      contextStrategy: "block",
      contextPendingFallback: () => <ScopeContextPending />,
      meta: { requiresAuth: true, unauthorizedRedirect: "/context/login" },
      middleware: [requireAuth],
      children: [createRoute("/context/admin", () => import("./pages/admin.tsx"))],
    }),
    createRoute("/context/login", {
      static: true,
      component: () => import("./pages/login.tsx"),
    }),
  ]
}

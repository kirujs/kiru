import type { RouteMiddleware } from "kiru/router"

declare module "kiru/router" {
  interface RouteMeta {
    requiresAuth?: boolean
    unauthorizedRedirect?: string
  }
}

const requireAuth: RouteMiddleware = (ctx) => {
  if (!ctx.meta.requiresAuth) return
  const user = (ctx.context as { user?: unknown }).user
  if (user) return
  const login =
    typeof ctx.meta.unauthorizedRedirect === "string"
      ? ctx.meta.unauthorizedRedirect
      : "/login"
  return { redirect: login }
}

export const blockUserZero: RouteMiddleware = (ctx) => {
  if (ctx.to.params.id === "0") return { redirect: "/about" }
}

export const routeMiddleware = [requireAuth, blockUserZero]

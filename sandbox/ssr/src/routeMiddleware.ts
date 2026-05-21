import type { RouteMiddleware } from "kiru/router"

declare module "kiru/router" {
  interface RouteMeta {
    requiresAuth?: boolean
    unauthorizedRedirect?: string
  }
}

export const requireAuth: RouteMiddleware = ({ context, meta }) => {
  if (!meta.requiresAuth) return
  const user = context.user
  if (user) return
  const login = typeof meta.unauthorizedRedirect === "string" ? meta.unauthorizedRedirect : "/login"
  return { redirect: login }
}

export const blockUserZero: RouteMiddleware = ({ to }) => {
  if (to.params.id === "0") return { redirect: "/about" }
}

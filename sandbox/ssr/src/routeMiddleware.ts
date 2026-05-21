import type { RouteMiddleware } from "kiru/router"

declare module "kiru/router" {
  interface RouteMeta {
    requiresAuth?: boolean
    unauthorizedRedirect?: string
  }
}

export const requireAuth: RouteMiddleware = ({ context, to }) => {
  if (!to.meta.requiresAuth) return
  const user = context.user
  if (user) return
  const login =
    typeof to.meta.unauthorizedRedirect === "string"
      ? to.meta.unauthorizedRedirect
      : "/login"
  return { redirect: login }
}

export const blockUserZero: RouteMiddleware = ({ to }) => {
  if (to.params.id === "0") return { redirect: "/about" }
}

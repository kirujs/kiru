import type { RouteMiddleware } from "kiru/router"
import type { AppRoute } from "./routes.gen.js"

declare module "kiru/router" {
  interface RouteMeta {
    requiresAuth?: boolean
    unauthorizedRedirect?: AppRoute
    guestOnly?: boolean
    guestRedirect?: AppRoute
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

/** Send signed-in users away from login/register-style routes. */
export const guestOnly: RouteMiddleware = ({ context, to }) => {
  if (!to.meta.guestOnly) return
  if (!context.user) return
  const dest =
    typeof to.meta.guestRedirect === "string" ? to.meta.guestRedirect : "/"
  return { redirect: dest }
}

export const blockUserZero: RouteMiddleware = ({ to }) => {
  if (to.params.username === "0") return { redirect: "/about" }
}

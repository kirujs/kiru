import type { RouteMiddleware } from "kiru/router"

declare module "kiru/router" {
  interface RouteMeta {
    requiresAuth?: boolean
    unauthorizedRedirect?: string
  }
}

/** E2E auth middleware — apps augment {@link RouteMeta} and supply their own. */
export const requireAuth: RouteMiddleware = (ctx) => {
  if (!ctx.meta.requiresAuth) return
  const user = ctx.context.user
  if (user) return
  const login = ctx.meta.unauthorizedRedirect ?? "/login"
  const next = encodeURIComponent(ctx.to.href)
  const sep = login.includes("?") ? "&" : "?"
  return {
    redirect: `${login}${sep}next=${next}`,
  }
}

import type { RouteMiddleware } from "kiru/router"

export const middleware: RouteMiddleware = () => ({
  redirect: "/about",
})

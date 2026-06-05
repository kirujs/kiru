import type { RouteMiddleware, RouteScopeConfig } from "kiru/router"

const redirectToAbout: RouteMiddleware = () => ({
  redirect: "/about",
})

export default {
  middleware: [redirectToAbout],
} satisfies RouteScopeConfig


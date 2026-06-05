import type { RouteScopeConfig } from "kiru/router"
import type { RouteMiddleware } from "kiru/router"

const redirectToAbout: RouteMiddleware = () => ({ redirect: "/about" })

export default {
  middleware: [redirectToAbout],
} satisfies RouteScopeConfig


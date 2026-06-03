import type { RouteMiddleware, RoutePageConfig } from "kiru/router"

const redirectToAbout: RouteMiddleware = () => ({
  redirect: "/about",
})

export default {
  static: false,
  middleware: [redirectToAbout],
} satisfies RoutePageConfig

import type { RoutePageConfig } from "kiru/router"

export default {
  meta: {
    requiresAuth: true,
    unauthorizedRedirect: "/login",
  },
  head: {
    title: "Settings — Threadboard",
  },
} satisfies RoutePageConfig

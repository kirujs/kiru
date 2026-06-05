import type { RoutePageConfig } from "kiru/router"

export default {
  meta: {
    requiresAuth: true,
    unauthorizedRedirect: "/login",
  },
  head: {
    title: "Create post — Threadboard",
  },
} satisfies RoutePageConfig

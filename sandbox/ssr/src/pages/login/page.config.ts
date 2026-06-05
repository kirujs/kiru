import type { RoutePageConfig } from "kiru/router"

export default {
  meta: {
    guestOnly: true,
    guestRedirect: "/",
  },
  head: {
    title: "Sign in — Threadboard",
  },
} satisfies RoutePageConfig

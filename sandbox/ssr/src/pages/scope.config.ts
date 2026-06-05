import type { RouteScopeConfig } from "kiru/router"
import { guestOnly, requireAuth } from "../routeMiddleware.js"

export default {
  head: {
    title: "Threadboard",
    description: "A Reddit-style community app on Kiru SSR.",
  },
  middleware: [requireAuth, guestOnly],
} satisfies RouteScopeConfig

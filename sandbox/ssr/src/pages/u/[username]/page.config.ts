import type { RoutePageConfig } from "kiru/router"
import { blockUserZero } from "../../../routeMiddleware.js"

export default {
  head: {
    description: "User profile on Threadboard.",
  },
  middleware: [blockUserZero],
} satisfies RoutePageConfig

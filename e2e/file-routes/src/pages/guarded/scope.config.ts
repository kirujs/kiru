import type { RouteScopeConfig } from "kiru/router"

export default {
  middleware: [() => ({ redirect: "/about" })],
} satisfies RouteScopeConfig

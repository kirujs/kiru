import { createRoute } from "kiru/router"
export const extendRoutes = [
  createRoute("/manual", () => import("./manual-page")),
] as const

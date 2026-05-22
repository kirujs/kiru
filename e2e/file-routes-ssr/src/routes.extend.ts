import { createRoute } from "kiru/router"

/** Hand-written routes merged into generated `routes.gen.ts` via `router.fileRoutes.extend`. */
export const extendRoutes = [
  createRoute("/manual", () => import("./pages/manual/page")),
] as const

import { defineRouteTree } from "kiru/router"

export const routes = defineRouteTree((r) =>
  r.scope({
    layout: () => import("./pages/layout.tsx"),
    children: [
      r.get("/", () => import("./pages/home.tsx")),
      r.get("/about", () => import("./pages/about.tsx")),
      r.get("/navigation", () => import("./pages/navigation.tsx")),
    ],
  })
)

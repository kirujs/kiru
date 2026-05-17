import { defineRouteTree } from "kiru/router"

export const routes = defineRouteTree((r) =>
  r.scope({
    layout: () => import("./pages/layout.tsx"),
    children: [
      r.page("/", () => import("./pages/home.tsx")),
      r.page("/about", () => import("./pages/about.tsx")),
      r.page("/navigation", () => import("./pages/navigation.tsx")),
      r.page("/loaders/client", () => import("./pages/loaders-client.tsx")),
      r.page(
        "/loaders/universal",
        () => import("./pages/loaders-universal.tsx")
      ),
    ],
  })
)

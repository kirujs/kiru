import { createRoute, createRouteTree } from "kiru/router"

export const routes = createRouteTree({
    layout: () => import("./pages/layout.tsx"),
    children: [
      createRoute("/", () => import("./pages/home.tsx")),
      createRoute("/about", () => import("./pages/about.tsx")),
      createRoute("/navigation", () => import("./pages/navigation.tsx")),
      createRoute("/loaders/client", () => import("./pages/loaders-client.tsx")),
      createRoute(
        "/loaders/universal",
        () => import("./pages/loaders-universal.tsx")
      ),
    ],
  })
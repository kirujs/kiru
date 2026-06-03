import { createRoute, createRouteTree } from "kiru/router"

export const routes = createRouteTree({
  layout: () => import("./pages/layout"),
  children: [
    createRoute("/", () => import("./pages/page")),
    createRoute("/about", () => import("./pages/about")),
  ],
})

import { createRoute, createRouteScope, createRouteTree } from "kiru/router"

export const routes = createRouteTree({
    layout: () => import("./pages/layout.tsx"),
    children: [
      createRoute("/", {
        component: () => import("./pages/index.tsx"),
        head: { title: "Matrix home" },
      }),
      createRoute("/hello", {
        component: () => import("./pages/hello.tsx"),
        head: { title: "Matrix hello" },
      }),
    ],
  })
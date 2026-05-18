import { defineRouteTree } from "kiru/router"

export const routes = defineRouteTree((r) =>
  r.scope({
    layout: () => import("./pages/layout.tsx"),
    children: [
      r.page("/", {
        component: () => import("./pages/index.tsx"),
        head: { title: "Bun home" },
      }),
      r.page("/hello", {
        component: () => import("./pages/hello.tsx"),
        head: { title: "Bun hello" },
      }),
      r.page("/__runtime", {
        component: () => import("./pages/runtime-check.tsx"),
        head: { title: "Runtime check" },
      }),
    ],
  })
)

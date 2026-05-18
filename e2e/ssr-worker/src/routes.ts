import { defineRouteTree } from "kiru/router"

export const routes = defineRouteTree((r) =>
  r.scope({
    layout: () => import("./pages/layout.tsx"),
    children: [
      r.page("/", {
        component: () => import("./pages/index.tsx"),
        head: { title: "Worker home" },
      }),
      r.page("/docs", {
        static: true,
        component: () => import("./pages/docs.tsx"),
        head: { title: "Worker docs (static)" },
      }),
      r.page("/hello", {
        component: () => import("./pages/hello.tsx"),
        head: { title: "Worker hello (SSR)" },
      }),
    ],
  })
)

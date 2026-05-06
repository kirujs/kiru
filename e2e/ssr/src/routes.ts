import { defineRouteTree } from "kiru/router"

export const routes = defineRouteTree((r) =>
  r.scope({
    meta: { description: "E2E SSR app." },
    layout: () => import("./pages/layout.tsx"),
    children: [
      r.get("/", {
        component: () => import("./pages/index.tsx"),
        meta: { title: "E2E SSR Home" },
      }),
    ],
  })
)

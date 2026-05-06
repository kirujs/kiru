import { defineRouteTree } from "kiru/router"

export const routes = defineRouteTree((r) =>
  r.scope({
    static: true,
    meta: { description: "E2E SSG app." },
    layout: () => import("./pages/layout.tsx"),
    children: [
      r.get("/", {
        component: () => import("./pages/index.tsx"),
        meta: { title: "E2E SSG Home" },
      }),
    ],
  })
)

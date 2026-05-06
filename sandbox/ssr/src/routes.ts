import { defineRouteTree } from "kiru/router"

export const routes = defineRouteTree((r) =>
  r.scope({
    head: {
      description: "Kiru server-rendered sandbox.",
    },
    layout: () => import("./pages/layout.tsx"),
    children: [
      r.get("/", {
        component: () => import("./pages/index.tsx"),
        head: {
          title: "Home — Kiru SSR",
          description: "Welcome to the Kiru SSR demo.",
        },
      }),
      r.get("/about", {
        component: () => import("./pages/about.tsx"),
        head: {
          title: "About — Kiru SSR",
          description: "About this server-rendered app.",
        },
      }),
      r.get("/users/[id]", {
        component: () => import("./pages/user.tsx"),
        beforeEnter: (to) => {
          console.log("beforeEnter", to)
          if (to.params.id === "0") return "/about"
          return
        },
        head: {
          title: "User {id} — Kiru SSR",
          description: "Dynamic user profile (SSR).",
        },
      }),
    ],
  })
)

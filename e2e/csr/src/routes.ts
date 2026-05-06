import { defineRouteTree } from "kiru/router"

export const routes = defineRouteTree((r) =>
  r.scope({
    layout: () => import("./pages/layout.tsx"),
    notFound: () => import("./pages/not-found/index.tsx"),
    children: [
      r.get("/", () => import("./pages/index.tsx")),
      r.get("/about", () => import("./pages/about/index.tsx")),
      r.get("/users/[id]", () => import("./pages/users/user-id.tsx")),
      r.get("/guarded", {
        component: async () => ({
          default: () => "Guarded should redirect",
        }),
        beforeEnter: () => "/about",
      }),
      r.get("/counter", () => import("./pages/counter/index.tsx")),
      r.get("/effects", () => import("./pages/effects/index.tsx")),
      r.get("/keyed-list", () => import("./pages/keyed-list/index.tsx")),
      r.get("/signals", () => import("./pages/signals/index.tsx")),
      r.get("/style", () => import("./pages/style/index.tsx")),
      r.get("/todos", () => import("./pages/todos/index.tsx")),
    ],
  })
)

export const routeLinks = [
  { path: "/", displayName: "home" },
  { path: "/about", displayName: "about" },
  { path: "/users/42", displayName: "user-42" },
  { path: "/guarded", displayName: "guarded-redirect" },
  { path: "/counter", displayName: "counter" },
  { path: "/effects", displayName: "effects" },
  { path: "/keyed-list", displayName: "keyed-list" },
  { path: "/signals", displayName: "signals" },
  { path: "/style", displayName: "style" },
  { path: "/todos", displayName: "todos" },
]

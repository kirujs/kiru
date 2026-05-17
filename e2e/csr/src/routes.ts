import { defineRouteTree } from "kiru/router"

export const routes = defineRouteTree((r) =>
  r.scope({
    layout: () => import("./pages/layout.tsx"),
    notFound: () => import("./pages/not-found/index.tsx"),
    children: [
      r.page("/", () => import("./pages/index.tsx")),
      r.page("/about", () => import("./pages/about/index.tsx")),
      r.page("/users/[id]", () => import("./pages/users/[id]/index.tsx")),
      r.page("/guarded", {
        component: async () => ({
          default: () => "Guarded should redirect",
        }),
        beforeEnter: () => "/about",
      }),
      r.page("/counter", () => import("./pages/counter/index.tsx")),
      r.page("/effects", () => import("./pages/effects/index.tsx")),
      r.page("/keyed-list", () => import("./pages/keyed-list/index.tsx")),
      r.page("/signals", () => import("./pages/signals/index.tsx")),
      r.page("/style", () => import("./pages/style/index.tsx")),
      r.page("/todos", () => import("./pages/todos/index.tsx")),
      r.page("/navigation", () => import("./pages/navigation/index.tsx")),
      r.page("/slow-target", {
        component: async () => {
          await new Promise((resolve) => setTimeout(resolve, 400))
          return import("./pages/slow-target/index.tsx")
        },
      }),
      r.page("/loaders/client", () => import("./pages/loaders/client.tsx")),
      r.page(
        "/loaders/universal",
        () => import("./pages/loaders/universal.tsx")
      ),
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
  { path: "/navigation", displayName: "navigation" },
  { path: "/loaders/client", displayName: "loaders-client" },
  { path: "/loaders/universal", displayName: "loaders-universal" },
]

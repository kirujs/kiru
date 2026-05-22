import { createRoute, createRouteTree } from "kiru/router"

export const routes = createRouteTree({
  layout: () => import("./pages/layout.tsx"),
  notFound: () => import("./pages/not-found/index.tsx"),
  error: () => import("./pages/csr-error-page.tsx"),
  children: [
    createRoute("/", () => import("./pages/index.tsx")),
    createRoute("/about", () => import("./pages/about/index.tsx")),
    createRoute("/users/[id]", () => import("./pages/users/[id]/index.tsx")),
    createRoute("/guarded", {
      component: async () => ({
        default: () => "Guarded should redirect",
      }),
      middleware: [() => ({ redirect: "/about" })],
    }),
    createRoute("/forbidden", {
      component: () => import("./pages/forbidden.tsx"),
      middleware: [() => ({ error: 403, body: "Forbidden" })],
    }),
    createRoute("/hash-section", () => import("./pages/hash-section/index.tsx")),
    createRoute("/counter", () => import("./pages/counter/index.tsx")),
    createRoute("/effects", () => import("./pages/effects/index.tsx")),
    createRoute("/keyed-list", () => import("./pages/keyed-list/index.tsx")),
    createRoute("/signals", () => import("./pages/signals/index.tsx")),
    createRoute("/style", () => import("./pages/style/index.tsx")),
    createRoute("/todos", () => import("./pages/todos/index.tsx")),
    createRoute("/navigation", () => import("./pages/navigation/index.tsx")),
    createRoute("/csr-break", () => import("./pages/csr-break.tsx")),
    createRoute("/csr-break-loader", () => import("./pages/csr-break-loader.tsx")),
    createRoute("/view-transitions", () => import("./pages/view-transitions/index.tsx")),
    createRoute("/slow-target", {
      component: async () => {
        await new Promise((resolve) => setTimeout(resolve, 400))
        return import("./pages/slow-target/index.tsx")
      },
    }),
    createRoute("/loaders/client", () => import("./pages/loaders/client.tsx")),
    createRoute(
      "/loaders/universal",
      () => import("./pages/loaders/universal.tsx")
    ),
  ],
})

export const routeLinks = [
  { path: "/", displayName: "home" },
  { path: "/about", displayName: "about" },
  { path: "/users/42", displayName: "user-42" },
  { path: "/guarded", displayName: "guarded-redirect" },
  { path: "/forbidden", displayName: "forbidden" },
  { path: "/hash-section", displayName: "hash-section" },
  { path: "/counter", displayName: "counter" },
  { path: "/effects", displayName: "effects" },
  { path: "/keyed-list", displayName: "keyed-list" },
  { path: "/signals", displayName: "signals" },
  { path: "/style", displayName: "style" },
  { path: "/todos", displayName: "todos" },
  { path: "/navigation", displayName: "navigation" },
  { path: "/csr-break", displayName: "csr-break" },
  { path: "/csr-break-loader", displayName: "csr-break-loader" },
  { path: "/loaders/client", displayName: "loaders-client" },
  { path: "/loaders/universal", displayName: "loaders-universal" },
]

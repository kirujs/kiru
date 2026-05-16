import { defineRouteTree } from "kiru/router"

export const routes = defineRouteTree((r) =>
  r.scope({
    head: { description: "E2E SSR app." },
    layout: () => import("./pages/layout.tsx"),
    notFound: () => import("./pages/not-found"),
    children: [
      r.get("/", {
        component: () => import("./pages/index.tsx"),
        head: { title: "E2E SSR Home" },
      }),
      r.get("/hello", {
        component: () => import("./pages/hello.tsx"),
        head: { title: "E2E SSR Hello" },
      }),
      r.get("/about", {
        component: () => import("./pages/about"),
        head: { title: "E2E SSR About" },
      }),
      r.get("/users/[id]", {
        component: () => import("./pages/user"),
        head: { title: "E2E SSR User {id}" },
      }),
      r.get("/streaming-test", {
        component: () => import("./pages/streaming-test"),
        head: { title: "E2E SSR Streaming test" },
      }),
      r.get("/guarded", {
        component: async () => ({
          default: () => "This page should be redirected away.",
        }),
        beforeEnter: () => "/",
        head: { title: "Guarded Route" },
      }),
      r.get("/blocked", {
        component: async () => ({
          default: () => "If you see this, leave guard failed.",
        }),
        head: { title: "Blocked Route" },
      }),
    ],
  })
)

import { defineRouteTree } from "kiru/router"

export const routes = defineRouteTree((r) =>
  r.scope({
    head: { description: "E2E SSR app." },
    layout: () => import("./pages/layout.tsx"),
    notFound: () => import("./pages/not-found"),
    error: () => import("./pages/error-page"),
    children: [
      r.get("/", {
        component: () => import("./pages/index.tsx"),
        head: {
          title: "E2E SSR Home",
          jsonLd: {
            "@context": "https://schema.org",
            "@type": "WebPage",
            name: "E2E SSR Home",
          },
        },
      }),
      r.get("/seo", {
        component: () => import("./pages/seo"),
        head: {
          title: "E2E SSR SEO",
          jsonLd: { "@type": "WebPage", name: "E2E SSR SEO" },
        },
      }),
      r.get("/hello", {
        component: () => import("./pages/hello.tsx"),
        head: { title: "E2E SSR Hello" },
      }),
      r.get("/loaders/server", {
        component: () => import("./pages/loaders-server"),
        head: { title: "E2E SSR server loader" },
      }),
      r.get("/about", {
        component: () => import("./pages/about"),
        head: { title: "E2E SSR About" },
      }),
      r.get("/docs", {
        static: true,
        component: () => import("./pages/docs"),
        head: { title: "E2E SSR Docs (static)" },
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
      r.get("/ssr-break", {
        component: () => import("./pages/ssr-break"),
        head: { title: "SSR error (scope)" },
      }),
      r.get("/ssr-break-leaf", {
        component: () => import("./pages/ssr-break-leaf"),
        error: () => import("./pages/leaf-error-page"),
        head: { title: "SSR error (leaf)" },
      }),
    ],
  })
)

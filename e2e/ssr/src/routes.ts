import { defineRouteTree } from "kiru/router"

export const routes = defineRouteTree((r) =>
  r.scope({
    head: { description: "E2E SSR app." },
    layout: () => import("./pages/layout.tsx"),
    notFound: () => import("./pages/not-found"),
    error: () => import("./pages/error-page"),
    children: [
      r.page("/", {
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
      r.page("/seo", {
        component: () => import("./pages/seo"),
        head: {
          title: "E2E SSR SEO",
          jsonLd: { "@type": "WebPage", name: "E2E SSR SEO" },
        },
      }),
      r.page("/head-override", {
        component: () => import("./pages/head-override"),
        head: { title: "E2E SSR From route definition" },
      }),
      r.page("/hello", {
        component: () => import("./pages/hello.tsx"),
        head: { title: "E2E SSR Hello" },
      }),
      r.page("/loaders/server", {
        component: () => import("./pages/loaders-server"),
        head: { title: "E2E SSR server loader" },
      }),
      r.page(
        "/loaders/server-immediate-shell",
        () => import("./pages/loaders-server-immediate-shell")
      ),
      r.page("/about", {
        component: () => import("./pages/about"),
        head: { title: "E2E SSR About" },
      }),
      r.page("/docs", {
        static: true,
        component: () => import("./pages/docs"),
        head: { title: "E2E SSR Docs (static)" },
      }),
      r.page("/users/[id]", {
        component: () => import("./pages/user"),
        head: { title: "E2E SSR User {id}" },
      }),
      r.page("/streaming-test", {
        component: () => import("./pages/streaming-test"),
        head: { title: "E2E SSR Streaming test" },
      }),
      r.page("/nested-streaming-test", {
        component: () => import("./pages/nested-streaming-test"),
        head: { title: "E2E SSR Nested streaming test" },
      }),
      r.page("/guarded", {
        component: async () => ({
          default: () => "This page should be redirected away.",
        }),
        beforeEnter: () => "/",
        head: { title: "Guarded Route" },
      }),
      r.page("/blocked", {
        component: async () => ({
          default: () => "If you see this, leave guard failed.",
        }),
        head: { title: "Blocked Route" },
      }),
      r.page("/ssr-break", {
        component: () => import("./pages/ssr-break"),
        head: { title: "SSR error (scope)" },
      }),
      r.page("/ssr-break-leaf", {
        component: () => import("./pages/ssr-break-leaf"),
        error: () => import("./pages/leaf-error-page"),
        head: { title: "SSR error (leaf)" },
      }),
    ],
  })
)

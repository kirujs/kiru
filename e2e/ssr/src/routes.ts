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
      r.page("/forms/demo", {
        component: () => import("./pages/forms-demo.tsx"),
        head: { title: "E2E SSR Form action" },
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
        component: () => import("./pages/about.tsx"),
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
      r.page("/url-state/[id]", {
        component: () => import("./pages/url-state"),
        head: { title: "E2E SSR URL state" },
      }),
      r.page("/search-schema", {
        component: () => import("./pages/search-schema"),
        head: { title: "E2E SSR search schema" },
      }),
      r.page("/invalidate-demo", {
        component: () => import("./pages/invalidate-demo"),
        head: { title: "E2E SSR invalidate" },
      }),
      r.page("/loader-cache-demo", {
        component: () => import("./pages/loader-cache-demo"),
        head: { title: "E2E SSR loader cache" },
      }),
      r.page("/revalidate-demo", {
        static: true,
        component: () => import("./pages/revalidate-demo"),
        head: { title: "E2E SSR revalidate" },
      }),
      r.page("/ppr/force-dynamic", {
        static: true,
        component: () => import("./pages/ppr-force-dynamic-demo"),
        head: { title: "E2E PPR force-dynamic" },
      }),
      r.page("/ppr/force-static", {
        component: () => import("./pages/ppr-force-static-demo"),
        head: { title: "E2E PPR force-static" },
      }),
      r.page("/image-demo", {
        component: () => import("./pages/image-demo"),
        head: { title: "E2E KiruImage" },
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

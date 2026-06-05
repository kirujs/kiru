import { createRoute, createRouteTree } from "kiru/router"

export const routes = createRouteTree({
    head: { description: "E2E SSR app." },
    layout: () => import("./pages/layout.tsx"),
    notFound: () => import("./pages/not-found"),
    error: () => import("./pages/error-page"),
    children: [
      createRoute("/", {
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
      createRoute("/seo", {
        component: () => import("./pages/seo"),
        head: {
          title: "E2E SSR SEO",
          jsonLd: { "@type": "WebPage", name: "E2E SSR SEO" },
        },
      }),
      createRoute("/head-override", {
        component: () => import("./pages/head-override"),
        head: { title: "E2E SSR From route definition" },
      }),
      createRoute("/hello", {
        component: () => import("./pages/hello.tsx"),
        head: { title: "E2E SSR Hello" },
      }),
      createRoute("/forms/demo", {
        component: () => import("./pages/forms-demo.tsx"),
        head: { title: "E2E SSR Form action" },
      }),
      createRoute("/loaders/server", {
        component: () => import("./pages/loaders-server"),
        head: { title: "E2E SSR server loader" },
      }),
      createRoute(
        "/loaders/server-immediate-shell",
        () => import("./pages/loaders-server-immediate-shell")
      ),
      createRoute("/about", {
        component: () => import("./pages/about.tsx"),
        head: { title: "E2E SSR About" },
      }),
      createRoute("/docs", {
        static: true,
        component: () => import("./pages/docs"),
        head: { title: "E2E SSR Docs (static)" },
      }),
      createRoute("/users/[id]", {
        component: () => import("./pages/user"),
      }),
      createRoute("/url-state/[id]", {
        component: () => import("./pages/url-state"),
        head: { title: "E2E SSR URL state" },
      }),
      createRoute("/search-schema", {
        component: () => import("./pages/search-schema"),
        head: { title: "E2E SSR search schema" },
      }),
      createRoute("/invalidate-demo", {
        component: () => import("./pages/invalidate-demo"),
        head: { title: "E2E SSR invalidate" },
      }),
      createRoute("/requested-queries-demo", {
        component: () => import("./pages/requested-queries-demo"),
        head: { title: "E2E SSR requested queries" },
      }),
      createRoute("/loader-cache-demo", {
        component: () => import("./pages/loader-cache-demo"),
        head: { title: "E2E SSR loader cache" },
      }),
      createRoute("/revalidate-demo", {
        static: true,
        component: () => import("./pages/revalidate-demo"),
        head: { title: "E2E SSR revalidate" },
      }),
      createRoute("/ppr/force-dynamic", {
        static: true,
        component: () => import("./pages/ppr-force-dynamic-demo"),
        head: { title: "E2E PPR force-dynamic" },
      }),
      createRoute("/ppr/force-static", {
        component: () => import("./pages/ppr-force-static-demo"),
        head: { title: "E2E PPR force-static" },
      }),
      createRoute("/streaming-test", {
        component: () => import("./pages/streaming-test"),
        head: { title: "E2E SSR Streaming test" },
      }),
      createRoute("/nested-streaming-test", {
        component: () => import("./pages/nested-streaming-test"),
        head: { title: "E2E SSR Nested streaming test" },
      }),
      createRoute("/guarded", {
        component: async () => ({
          default: () => "This page should be redirected away.",
        }),
        middleware: [() => ({ redirect: "/" })],
        head: { title: "Guarded Route" },
      }),
      createRoute("/forbidden", {
        component: () => import("./pages/forbidden"),
        middleware: [() => ({ error: 403, body: "Forbidden" })],
        head: { title: "Forbidden" },
      }),
      createRoute("/blocked", {
        component: async () => ({
          default: () => "If you see this, leave guard failed.",
        }),
        head: { title: "Blocked Route" },
      }),
      createRoute("/ssr-break", {
        component: () => import("./pages/ssr-break"),
        head: { title: "SSR error (scope)" },
      }),
      createRoute("/ssr-break-leaf", {
        component: () => import("./pages/ssr-break-leaf"),
        error: () => import("./pages/leaf-error-page"),
        head: { title: "SSR error (leaf)" },
      }),
      createRoute("/nav-break", {
        component: () => import("./pages/nav-break"),
        head: { title: "SSR nav error recovery" },
      }),
      createRoute("/context-concurrency", {
        component: () => import("./pages/context-concurrency"),
        head: { title: "E2E SSR context concurrency" },
      }),
      createRoute("/actions-composition-demo", {
        component: () => import("./pages/actions-composition-demo"),
        head: { title: "E2E SSR namespaced & composed actions" },
      }),
      createRoute("/action-middleware-demo", {
        component: () => import("./pages/action-middleware-demo"),
        head: { title: "E2E SSR action middleware" },
      }),
      createRoute("/default-export-demo", {
        component: () => import("./pages/default-export-demo"),
        head: { title: "E2E SSR default export actions" },
      }),
    ],
  })
import { defineRouteTree } from "kiru/router"

export const routes = defineRouteTree((r) =>
  r.scope({
    head: {
      description: "Kiru server-rendered sandbox.",
    },
    layout: () => import("./pages/layout.tsx"),
    error: () => import("./pages/error-page.tsx"),
    children: [
      r.page("/", {
        component: () => import("./pages/index.tsx"),
        head: {
          title: "Home — Kiru SSR",
          description: "Welcome to the Kiru SSR demo.",
          jsonLd: {
            "@context": "https://schema.org",
            "@type": "WebPage",
            name: "Kiru SSR Sandbox Home",
          },
        },
      }),
      r.page("/seo", {
        component: () => import("./pages/seo.tsx"),
        head: {
          title: "SEO — Kiru SSR",
          description: "JSON-LD and document head on server-rendered pages.",
          jsonLd: { "@type": "WebPage", name: "SEO — Kiru SSR" },
        },
      }),
      r.page("/about", {
        component: () => import("./pages/about.tsx"),
        head: {
          title: "About — Kiru SSR",
          description: "About this server-rendered app.",
        },
      }),
      r.page("/docs", {
        static: true,
        component: () => import("./pages/docs.tsx"),
        head: {
          title: "Docs — Kiru SSR (static)",
          description: "Prerendered documentation slice.",
          jsonLd: {
            "@type": "TechArticle",
            name: "Hybrid static docs",
          },
        },
      }),
      r.scope({
        contextStrategy: "block",
        meta: { requiresAuth: true },
        children: [
          r.page("/users/[id]", {
            component: () => import("./pages/user.tsx"),
            head: {
              description: "Dynamic user profile (SSR).",
            },
          }),
        ],
      }),
      r.page("/demo-loader", {
        component: () => import("./pages/demo-loader.tsx"),
        head: {
          title: "Route demo — Kiru SSR",
          description: "serverLoader + usePageData.",
        },
      }),
      r.page("/loaders/server", {
        component: () => import("./pages/loaders-server.tsx"),
        head: {
          title: "serverLoader — Kiru SSR",
          description: "Server-only route loader with CSR RPC.",
        },
      }),
      r.page("/break-ssr", {
        component: () => import("./pages/break-ssr.tsx"),
        head: {
          title: "SSR error demo — Kiru SSR",
          description: "Throws during render; scope error module recovers.",
        },
      }),
      r.page("/break-ssr-leaf", {
        component: () => import("./pages/break-ssr-leaf.tsx"),
        error: () => import("./pages/leaf-error-page.tsx"),
        head: {
          title: "SSR leaf error — Kiru SSR",
          description: "Leaf error handler overrides scope error.",
        },
      }),
    ],
  })
)

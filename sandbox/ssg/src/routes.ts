import { defineRouteTree } from "kiru/router"

export const routes = defineRouteTree((r) =>
  r.scope({
    static: true,
    head: {
      title: "Kiru SSG Sandbox",
      description: "Kiru static-site generation sandbox.",
    },
    layout: () => import("./pages/layout.tsx"),
    children: [
      r.page("/", {
        component: () => import("./pages/index.tsx"),
        head: {
          title: "Home — Kiru SSG",
          description: "Welcome to the Kiru SSG demo.",
          jsonLd: {
            "@context": "https://schema.org",
            "@type": "WebSite",
            name: "Kiru SSG Sandbox",
            url: "https://kiru-ssg-sandbox.example",
          },
        },
      }),
      r.page("/seo", {
        component: () => import("./pages/seo.tsx"),
        head: {
          title: "SEO — Kiru SSG",
          description:
            "Site config, sitemap, JSON-LD, and nested static params.",
          jsonLd: {
            "@type": "WebPage",
            name: "SEO examples",
          },
        },
      }),
      r.page("/about", {
        component: () => import("./pages/about.tsx"),
        head: {
          title: "About — Kiru SSG",
          description: "About this static site.",
        },
      }),
      r.page("/loaders/static", () => import("./pages/loadersStatic.tsx")),
      r.page("/blog", () => import("./pages/blog.tsx")),
      r.page("/blog/[slug]", {
        component: () => import("./pages/blogSlug.tsx"),
        head: {
          title: "Blog — Kiru SSG",
          description: "A statically generated blog post.",
        },
      }),
      r.page("/blog/[slug]/comments/[id]", {
        component: () => import("./pages/blogComment.tsx"),
        head: {
          title: "Blog comment — Kiru SSG",
          description:
            "Nested generateStaticParams (parent slug in ctx.params).",
        },
      }),
    ],
  })
)

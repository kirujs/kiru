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
      r.get("/", {
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
      r.get("/seo", {
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
      r.get("/about", {
        component: () => import("./pages/about.tsx"),
        head: {
          title: "About — Kiru SSG",
          description: "About this static site.",
        },
      }),
      r.get("/loaders/static", () => import("./pages/loadersStatic.tsx")),
      r.get("/blog", () => import("./pages/blog.tsx")),
      r.get("/blog/[slug]", {
        component: () => import("./pages/blogSlug.tsx"),
        head: {
          title: "Blog: {slug} — Kiru SSG",
          description: "A statically generated blog post.",
        },
      }),
      r.get("/blog/[slug]/comments/[id]", {
        component: () => import("./pages/blogComment.tsx"),
        head: {
          title: "Comment {id} on {slug}",
          description:
            "Nested generateStaticParams (parent slug in ctx.params).",
        },
      }),
    ],
  })
)

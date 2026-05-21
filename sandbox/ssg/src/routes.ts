import { createRoute, createRouteTree } from "kiru/router"

export const routes = createRouteTree({
    static: true,
    head: {
      title: "Kiru SSG Sandbox",
      description: "Kiru static-site generation sandbox.",
    },
    layout: () => import("./pages/layout.tsx"),
    children: [
      createRoute("/", {
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
      createRoute("/seo", {
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
      createRoute("/about", {
        component: () => import("./pages/about.tsx"),
        head: {
          title: "About — Kiru SSG",
          description: "About this static site.",
        },
      }),
      createRoute("/loaders/static", () => import("./pages/loadersStatic.tsx")),
      createRoute("/blog", () => import("./pages/blog.tsx")),
      createRoute("/blog/[slug]", {
        component: () => import("./pages/blogSlug.tsx"),
        head: {
          title: "Blog — Kiru SSG",
          description: "A statically generated blog post.",
        },
      }),
      createRoute("/blog/[slug]/comments/[id]", {
        component: () => import("./pages/blogComment.tsx"),
        head: {
          title: "Blog comment — Kiru SSG",
          description:
            "Nested generateStaticParams (parent slug in ctx.params).",
        },
      }),
    ],
  })
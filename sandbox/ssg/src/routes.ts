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
        },
      }),
      r.get("/about", {
        component: () => import("./pages/about.tsx"),
        head: {
          title: "About — Kiru SSG",
          description: "About this static site.",
        },
      }),
      r.get("/blog", () => import("./pages/blog.tsx")),
      r.get("/blog/[slug]", {
        component: () => import("./pages/blogSlug.tsx"),
        generateStaticParams: async () => [{ slug: "hello" }, { slug: "kiru" }],
        head: {
          title: "Blog: {slug} — Kiru SSG",
          description: "A statically generated blog post.",
        },
      }),
    ],
  })
)

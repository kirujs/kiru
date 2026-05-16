import { defineRouteTree } from "kiru/router"

export const routes = defineRouteTree((r) =>
  r.scope({
    static: true,
    head: { description: "E2E SSG app." },
    layout: () => import("./pages/layout.tsx"),
    notFound: () => import("./pages/not-found"),
    children: [
      r.get("/", {
        component: () => import("./pages/index.tsx"),
        head: {
          title: "E2E SSG Home",
          jsonLd: {
            "@context": "https://schema.org",
            "@type": "WebPage",
            name: "E2E SSG Home",
          },
        },
      }),
      r.get("/seo", {
        component: () => import("./pages/seo"),
        head: {
          title: "E2E SSG SEO",
          description: "JSON-LD and static path demos.",
          jsonLd: {
            "@type": "WebPage",
            name: "E2E SSG SEO",
          },
        },
      }),
      r.get("/about", {
        component: () => import("./pages/about"),
        head: { title: "E2E SSG About" },
      }),
      r.get("/loaders/static", {
        component: () => import("./pages/loaders-static"),
        head: { title: "E2E SSG static loader" },
      }),
      r.get("/posts/[slug]", {
        component: () => import("./pages/post"),
        head: { title: "E2E SSG Post {slug}" },
      }),
      r.get("/posts/[slug]/comments/[id]", {
        component: () => import("./pages/comment"),
        head: { title: "Comment {id} on {slug}" },
      }),
    ],
  })
)

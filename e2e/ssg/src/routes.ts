import { defineRouteTree } from "kiru/router"
import i18n from "./i18n.js"

export { i18n }

export const routes = defineRouteTree((r) =>
  r.scope({
    static: true,
    head: { description: "E2E SSG app." },
    layout: () => import("./pages/layout.tsx"),
    notFound: () => import("./pages/not-found"),
    children: [
      r.page("/", {
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
      r.page("/seo", {
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
      r.page("/about", {
        component: () => import("./pages/about"),
        head: { title: "E2E SSG About" },
      }),
      r.page("/loaders/static", {
        component: () => import("./pages/loaders-static"),
        head: { title: "E2E SSG static loader" },
      }),
      r.page("/posts/[slug]", {
        component: () => import("./pages/post"),
        head: { title: "E2E SSG Post {slug}" },
      }),
      r.page("/posts/[slug]/comments/[id]", {
        component: () => import("./pages/comment"),
        head: { title: "Comment {id} on {slug}" },
      }),
    ],
  })
)

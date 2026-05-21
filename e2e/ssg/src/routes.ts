import { createRoute, createRouteScope, createRouteTree } from "kiru/router"
import i18n from "./i18n.js"

export { i18n }

export const routes = createRouteTree({
    head: { description: "E2E SSG app." },
    layout: () => import("./pages/layout.tsx"),
    notFound: () => import("./pages/not-found"),
    children: [
      createRouteScope({
        static: true,
        children: [
          createRoute("/", {
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
          createRoute("/seo", {
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
          createRoute("/about", {
            component: () => import("./pages/about"),
            head: { title: "E2E SSG About" },
          }),
          createRoute("/image-demo", {
            component: () => import("./pages/image-demo"),
            head: { title: "E2E SSG Image" },
          }),
          createRoute("/loaders/static", {
            component: () => import("./pages/loaders-static"),
            head: { title: "E2E SSG static loader" },
          }),
          createRoute("/posts/[slug]", {
            component: () => import("./pages/post"),
            head: { title: "E2E SSG Post" },
          }),
          createRoute("/posts/[slug]/comments/[id]", {
            component: () => import("./pages/comment"),
            head: { title: "E2E SSG Comment" },
          }),
        ],
      }),
    ],
  })
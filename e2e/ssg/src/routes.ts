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
      r.get("/posts/[slug]", {
        static: true,
        component: () => import("./pages/post"),
        generateStaticParams: () => [{ slug: "one" }, { slug: "two" }],
        head: { title: "E2E SSG Post {slug}" },
      }),
      r.get("/posts/[slug]/comments/[id]", {
        static: true,
        component: () => import("./pages/comment"),
        generateStaticParams: ({ params }) => [
          { id: `${params.slug}-c1` },
          { id: `${params.slug}-c2` },
        ],
        head: { title: "Comment {id} on {slug}" },
      }),
    ],
  })
)

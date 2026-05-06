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
        head: { title: "E2E SSG Home" },
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
    ],
  })
)

export { routes } from "./routes.gen"

export const routeLinks = [
  { path: "/", displayName: "home" },
  { path: "/about", displayName: "about" },
  {
    path: "/blog/[slug]",
    displayName: "blog",
    params: { slug: "hello" },
  },
  { path: "/pricing", displayName: "pricing" },
  { path: "/manual", displayName: "manual" },
] as const

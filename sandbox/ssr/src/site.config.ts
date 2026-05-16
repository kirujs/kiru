import { defineSiteConfig } from "kiru/router"

/**
 * Used at `vite build` for the hybrid client bundle: prerenders `/docs` and
 * writes sitemap.xml / robots.txt next to other static assets in `dist/client`.
 */
export const site = defineSiteConfig({
  url: "https://kiru-ssr-sandbox.example",
  sitemap: true,
  robots: true,
})

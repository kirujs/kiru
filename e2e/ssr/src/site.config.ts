import { defineSiteConfig } from "kiru/router"

/** Used at build time for hybrid SSG (static /docs + sitemap). */
export const site = defineSiteConfig({
  url: "https://e2e-ssr.example",
  sitemap: true,
  robots: true,
})

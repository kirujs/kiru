import { defineSiteConfig } from "kiru/router"

/** Used at build time for hybrid SSG (static /docs + sitemap). */
export const site = defineSiteConfig({
  url: "https://e2e-ssr.example",
  locales: { default: "en", prefixes: ["en", "fr"] },
  sitemap: {
    include: ["/users/[id]"],
    exclude: [
      "/guarded",
      "/blocked",
      "/ssr-break",
      "/ssr-break-leaf",
      "/streaming-test",
      "/nested-streaming-test",
      "/loaders/server",
      "/loaders/server-immediate-shell",
    ],
  },
  robots: true,
})

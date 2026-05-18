import { defineSiteConfig } from "kiru/router"

export const site = defineSiteConfig({
  url: "https://e2e-ssg.example",
  locales: { default: "en", prefixes: ["en", "fr"] },
  sitemap: true,
  robots: true,
})

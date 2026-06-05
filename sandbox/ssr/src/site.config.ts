import { defineSiteConfig } from "kiru/router"

export const site = defineSiteConfig({
  url: "https://threadboard.kiru.example",
  sitemap: {
    include: ["/u/[username]"],
    exclude: ["/dev/errors"],
  },
  robots: true,
})

import { defineConfig } from "vite"
import kiru from "vite-plugin-kiru"

export default defineConfig({
  plugins: [
    kiru({
      loggingEnabled: true,
      ssg: {
        dir: "./src/pages",
        document: "document.tsx",
        page: "index.{tsx,jsx}",
        layout: "layout.{tsx,jsx}",
        transition: true,
        sitemap: {
          domain: "https://kiru.dev",
          lastmod: new Date(),
          changefreq: "monthly",
          priority: 0.5,
          overrides: {
            "/": {
              changefreq: "never",
              priority: 0.8,
              images: ["/images/kiru.png"],
              lastmod: new Date("2024-01-01"),
              videos: [
                {
                  title: "Kiru",
                  thumbnail_loc: "https://kiru.dev/images/kiru.png",
                  description:
                    "Kiru is a framework for building web applications.",
                },
              ],
            },
          },
        },
      },
    }),
  ],
})

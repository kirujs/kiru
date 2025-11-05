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
      },
    }),
  ],
})

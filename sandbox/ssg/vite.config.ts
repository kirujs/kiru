import { defineConfig } from "vite"
import kiru from "vite-plugin-kiru"

export default defineConfig({
  esbuild: {
    supported: {
      "top-level-await": true, //browsers can handle top-level-await features
    },
  },
  plugins: [
    // @ts-ignore
    kiru({
      include: ["../shared/"],
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

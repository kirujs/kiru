import { defineConfig } from "vite"
import kiru from "vite-plugin-kiru"

export default defineConfig({
  plugins: [
    kiru({
      router: {
        ssg: true,
        images: {
          optimize: true,
          formats: ["webp"],
          config: { strategy: "build" },
        },
      },
    }),
  ],
})

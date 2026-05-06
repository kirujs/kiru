import { defineConfig } from "vite"
import kiru from "vite-plugin-kiru"

export default defineConfig({
  plugins: [
    kiru({
      router: {
        routesModule: "./src/routes.ts",
        ssg: true,
      },
    }),
  ],
})

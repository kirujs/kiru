import { defineConfig } from "vite"
import kiru from "vite-plugin-kiru"

export default defineConfig({
  server: {
    port: 5176,
    strictPort: true,
    hmr: { port: 8016 },
  },
  plugins: [
    kiru({
      router: {
        ssg: true,
        fileRoutes: {
          extend: "./src/routes.extend.ts",
        },
      },
    }),
  ],
})

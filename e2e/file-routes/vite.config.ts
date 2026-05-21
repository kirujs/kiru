import { defineConfig } from "vite"
import kiru from "vite-plugin-kiru"

export default defineConfig({
  server: {
    port: 5175,
    strictPort: true,
    hmr: { port: 8015 },
  },
  plugins: [
    kiru({
      router: {
        fileRoutes: {
          extend: "./src/routes.extend.ts",
          //outFile: "./src/routes.gen.ts",
          //pageFiles: ["page.{tsx,ts,jsx,js}", "index.{tsx,ts,jsx,js}"],
          //dir: "./src/pages",
        },
      },
    }),
  ],
})

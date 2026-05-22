import { defineConfig } from "vite"
import kiru from "vite-plugin-kiru"

export default defineConfig({
  server: {
    port: 5193,
    strictPort: true,
    hmr: { port: 8023 },
  },
  ssr: {
    external: ["kiru"],
  },
  plugins: [
    kiru({
      router: {
        serverEntry: "./src/server.ts",
        fileRoutes: {
          extend: "./src/routes.extend.ts",
        },
      },
    }),
  ],
})

import { defineConfig } from "vite"
import kiru from "vite-plugin-kiru"
import { e2ePorts } from "../shared/ports.mjs"

export default defineConfig({
  server: {
    port: e2ePorts.fileRoutesSsg.dev,
    strictPort: true,
    hmr: { port: e2ePorts.fileRoutesSsg.hmr },
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

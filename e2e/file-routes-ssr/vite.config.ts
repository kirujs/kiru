import { defineConfig } from "vite"
import kiru from "vite-plugin-kiru"
import { e2ePorts, envDevPort, envHmrPort } from "../shared/ports.mjs"

export default defineConfig({
  server: {
    port: envDevPort(e2ePorts.fileRoutesSsr.dev),
    strictPort: true,
    hmr: { port: envHmrPort(e2ePorts.fileRoutesSsr.hmr) },
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

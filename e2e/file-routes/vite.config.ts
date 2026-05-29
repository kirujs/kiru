import { defineConfig } from "vite"
import kiru from "vite-plugin-kiru"
import { e2ePorts, envDevPort, envHmrPort } from "../shared/ports.mjs"

export default defineConfig({
  server: {
    port: envDevPort(e2ePorts.fileRoutes.dev),
    strictPort: true,
    hmr: { port: envHmrPort(e2ePorts.fileRoutes.hmr) },
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

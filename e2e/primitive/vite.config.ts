import { defineConfig } from "vite"
import kiru from "vite-plugin-kiru"
import { e2ePorts, envDevPort, envHmrPort } from "../shared/ports.mjs"

export default defineConfig({
  server: {
    port: envDevPort(e2ePorts.primitive.dev),
    strictPort: true,
    hmr: {
      port: envHmrPort(e2ePorts.primitive.hmr),
    },
  },
  plugins: [
    kiru({
      experimental: {
        staticHoisting: true,
      },
    }),
  ],
})

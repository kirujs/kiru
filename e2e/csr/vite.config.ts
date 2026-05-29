import { defineConfig } from "vite"
import kiru from "vite-plugin-kiru"
import { e2ePorts, envDevPort, envHmrPort } from "../shared/ports.mjs"

export default defineConfig({
  server: {
    port: envDevPort(e2ePorts.csr.core.dev),
    strictPort: true,
    hmr: {
      port: envHmrPort(e2ePorts.csr.core.hmr),
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

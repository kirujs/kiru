import { defineConfig } from "vite"
import kiru from "vite-plugin-kiru"
import { e2ePorts, envDevPort, envHmrPort } from "../shared/ports.mjs"

export default defineConfig({
  plugins: [kiru({ experimental: { domCodegen: true } })],
  server: {
    port: envDevPort(e2ePorts.dom.dev),
    strictPort: true,
    hmr: {
      port: envHmrPort(e2ePorts.dom.hmr),
    },
  },
})

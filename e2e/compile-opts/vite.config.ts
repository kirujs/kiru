import { defineConfig } from "vite"
import kiru from "vite-plugin-kiru"
import { e2ePorts } from "../shared/ports.mjs"

export default defineConfig({
  server: {
    port: e2ePorts.compileOpts.dev,
    strictPort: true,
    hmr: {
      port: e2ePorts.compileOpts.hmr,
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

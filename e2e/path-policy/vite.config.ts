import { defineConfig } from "vite"
import kiru from "vite-plugin-kiru"
import { e2ePorts } from "../shared/ports.mjs"

export default defineConfig({
  base: "/app/",
  server: {
    port: e2ePorts.pathPolicy.dev,
    strictPort: true,
    hmr: { port: e2ePorts.pathPolicy.hmr },
  },
  plugins: [kiru()],
})

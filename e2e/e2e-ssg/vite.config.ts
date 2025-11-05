import { defineConfig } from "vite"
import kiru from "vite-plugin-kiru"

export default defineConfig({
  server: {
    hmr: {
      port: 8002,
    },
  },
  plugins: [kiru({ ssg: true })],
})

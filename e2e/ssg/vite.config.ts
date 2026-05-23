import { defineConfig } from "vite"
import kiru from "vite-plugin-kiru"
import { e2ePorts } from "../shared/ports.mjs"

export default defineConfig({
  server: {
    hmr: { port: e2ePorts.ssg.hmr },
  },
  plugins: [
    kiru({
      router: {
        ssg: true,
      },
    }),
  ],
})

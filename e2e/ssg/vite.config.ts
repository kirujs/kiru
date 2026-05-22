import { defineConfig } from "vite"
import kiru from "vite-plugin-kiru"

export default defineConfig({
  server: {
    hmr: { port: 8030 },
  },
  plugins: [
    kiru({
      router: {
        ssg: true,
      },
    }),
  ],
})

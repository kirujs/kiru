import { defineConfig } from "vite"
import kiru from "vite-plugin-kiru"

export default defineConfig({
  plugins: [
    kiru({
      loggingEnabled: true,
      ssg: { transition: true },
    }),
  ],
})

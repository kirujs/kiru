import { defineConfig } from "vite"
import kiru from "vite-plugin-kiru"

export default defineConfig({
  plugins: [
    kiru({
      devtools: true,
      include: ["../shared/"],
      loggingEnabled: true,
      experimental: {
        staticHoisting: true,
      },
    }),
  ],
})

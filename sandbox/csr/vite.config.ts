import { defineConfig } from "vite"
import kiru from "vite-plugin-kiru"

export default defineConfig({
  esbuild: {
    supported: {
      "top-level-await": true, //browsers can handle top-level-await features
    },
  },
  plugins: [
    kiru({
      include: ["../shared/"],
      loggingEnabled: true,
      fileRouter: true,
    }),
  ],
})

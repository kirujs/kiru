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
      //devtools: false,
      loggingEnabled: true,
      experimental: {
        // TODO: static hoisting is not working with the primitive app...
        // good thing it's still experimental 😅
        staticHoisting: false,
      },
    }),
  ],
})

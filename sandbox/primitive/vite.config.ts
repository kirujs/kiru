import { defineConfig } from "vite"
import kiru from "vite-plugin-kiru"

export default defineConfig({
  plugins: [
    kiru({
      loggingEnabled: true,
      experimental: {
        // TODO: static hoisting is not working with the primitive app...
        // good thing it's still experimental 😅
        staticHoisting: false,
      },
    }),
  ],
})

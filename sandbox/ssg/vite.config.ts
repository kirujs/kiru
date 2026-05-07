import { defineConfig } from "vite"
import tailwindcss from "@tailwindcss/vite"
import kiru from "vite-plugin-kiru"

export default defineConfig({
  plugins: [
    tailwindcss(),
    kiru({
      router: {
        ssg: true,
      },
    }),
  ],
})

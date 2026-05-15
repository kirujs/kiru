import { defineConfig } from "vite"
import tailwindcss from "@tailwindcss/vite"
import kiru from "vite-plugin-kiru"

export default defineConfig({
  ssr: {
    external: ["kiru"],
  },
  plugins: [
    tailwindcss(),
    kiru({
      router: {
        serverEntry: "./src/server/index.ts",
        remote: "**/*.actions.ts",
      },
    }),
  ],
})

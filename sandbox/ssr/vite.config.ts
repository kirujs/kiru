import { defineConfig, type PluginOption } from "vite"
import tailwindcss from "@tailwindcss/vite"
import kiru from "vite-plugin-kiru"

export default defineConfig({
  plugins: [
    tailwindcss(),
    kiru({
      router: {
        serverEntry: "./src/server.ts",
      },
    }),
  ] as PluginOption[],
})

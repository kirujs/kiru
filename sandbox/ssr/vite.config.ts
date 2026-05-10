import devServer from "@hono/vite-dev-server"
import { defineConfig, type PluginOption } from "vite"
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
        serverEntry: "./src/server.ts",
        remote: "**/*.actions.ts",
      },
    }),
    devServer({
      entry: "src/server.ts",
      injectClientScript: false,
    }),
  ] as PluginOption[],
})

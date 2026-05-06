import devServer from "@hono/vite-dev-server"
import { defineConfig, type PluginOption } from "vite"
import tailwindcss from "@tailwindcss/vite"
import kiru from "vite-plugin-kiru"

export default defineConfig({
  plugins: [
    tailwindcss(),
    kiru({
      router: {
        routesModule: "./src/routes.ts",
      },
    }),
    devServer({
      entry: "src/server.ts",
      injectClientScript: false,
    }),
  ] as PluginOption[],
})

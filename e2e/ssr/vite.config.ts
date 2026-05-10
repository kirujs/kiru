import devServer from "@hono/vite-dev-server"
import { defineConfig, type PluginOption } from "vite"
import kiru from "vite-plugin-kiru"

export default defineConfig({
  /** One Node copy of `kiru/remote` so the action registry matches `createRemoteActionHandler`. */
  ssr: {
    external: ["kiru"],
  },
  plugins: [
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

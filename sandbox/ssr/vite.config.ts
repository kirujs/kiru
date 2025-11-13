import { defineConfig } from "vite"
import kiru from "vite-plugin-kiru"
import devServer from "@hono/vite-dev-server"

export default defineConfig({
  plugins: [
    kiru({ ssr: true, loggingEnabled: true }),
    devServer({
      entry: "./src/server/hono-entry.ts",
      exclude: [
        /^\/@.+$/,
        /.*\.(ts|tsx)($|\?)/,
        /.*\.(s?css|less)($|\?)/,
        /^\/favicon\.ico$/,
        /.*\.(svg|png)($|\?)/,
        /^\/(public|assets|static)\/.+/,
        /^\/node_modules\/.*/,
      ],
      injectClientScript: false,
    }),
  ],
})

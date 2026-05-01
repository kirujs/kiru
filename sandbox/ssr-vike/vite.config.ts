import path from "node:path"
import { defineConfig } from "vite"
import vike from "vike/plugin"
import kiru from "vite-plugin-kiru"
import tailwindcss from "@tailwindcss/vite"
import devServer from "@hono/vite-dev-server"

export default defineConfig({
  resolve: {
    alias: {
      $: path.join(__dirname, "src"),
    },
  },
  plugins: [
    vike(),
    kiru(),
    tailwindcss(),
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

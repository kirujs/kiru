import { defineConfig } from "vite"
import kiru from "vite-plugin-kiru"
import devServer from "@hono/vite-dev-server"

export default defineConfig({
  resolve: {
    alias: {
      "@": "./src",
    },
  },
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
      /**
       * This is necessary to prevent full hot reloads.
       * As far as I can tell, server modules will still be replaced anyway.
       */
      handleHotUpdate: () => {},
    }),
  ],
})

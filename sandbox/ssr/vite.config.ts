import path from "path"
import { defineConfig } from "vite"
import kiru from "vite-plugin-kiru"
import devServer from "@hono/vite-dev-server"
import dotenv from "dotenv"
dotenv.config()

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  plugins: [
    kiru({
      ssr: {
        runtimeEntry: "./src/server/hono-entry.node.ts",
        secret: process.env.KIRU_SERVER_SECRET,
        transition: true,
      },
      loggingEnabled: true,
    }),
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
       *
       * commenting this out here because we need full reloads
       * during kiru development
       */
      // handleHotUpdate: () => {},
    }),
  ],
})

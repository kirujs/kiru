import path from "node:path"
import { defineConfig } from "vite"
import ssr from "vike/plugin"
import kiru from "vite-plugin-kiru"

export default defineConfig({
  esbuild: {
    //sourcemap: false,
    supported: {
      "top-level-await": true, //browsers can handle top-level-await features
    },
  },
  resolve: {
    alias: {
      $: path.join(__dirname, "src"),
    },
  },
  plugins: [ssr(), kiru({ include: ["../shared/"] })],
})

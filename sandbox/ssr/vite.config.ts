import path from "node:path"
import { defineConfig } from "vite"
import vike from "vike/plugin"
import kiru from "vite-plugin-kiru"

export default defineConfig({
  resolve: {
    alias: {
      $: path.join(__dirname, "src"),
    },
  },
  plugins: [vike(), kiru()],
})

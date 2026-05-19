import { defineConfig } from "vite"
import kiru from "vite-plugin-kiru"
import { getCellConfig } from "./scripts/cells.mjs"

const cell = getCellConfig(process.env.KIRU_MATRIX_CELL ?? "node-fetch")

export default defineConfig({
  ssr:
    cell.adapter === "cloudflare"
      ? {
          noExternal: ["kiru", "@kirujs/adapter-cloudflare", "@kirujs/runtime"],
        }
      : { external: ["kiru"] },
  plugins: [
    kiru({
      router: {
        adapter: cell.adapter,
        serverEntry: cell.serverEntry,
        ssg: true,
        ...(cell.adapter === "cloudflare"
          ? { images: { config: { strategy: "build" } } }
          : {}),
      },
    }),
  ],
})

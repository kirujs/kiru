import path from "node:path"
import { fileURLToPath } from "node:url"
import { defineConfig } from "vite"
import kiru from "vite-plugin-kiru"
import { cellHmrPort } from "./scripts/cell-dist.mjs"
import { getCellConfig } from "./scripts/cells.mjs"

const cell = getCellConfig(process.env.KIRU_MATRIX_CELL ?? "node-fetch")
const root = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  cacheDir: path.join(root, "node_modules", `.vite-matrix-${cell.id}`),
  build: {
    outDir: `dist/cells/${cell.id}/client`,
  },
  // kiru may touch the dev optimizer during `vite build`; unique HMR + cache per cell avoids port 24678 clashes.
  server: {
    strictPort: true,
    hmr: {
      host: "127.0.0.1",
      port: cellHmrPort(cell.id),
      clientPort: cellHmrPort(cell.id),
    },
  },
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
      },
    }),
  ],
})

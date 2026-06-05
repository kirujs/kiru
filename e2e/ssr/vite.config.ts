import { defineConfig } from "vite"
import kiru from "vite-plugin-kiru"
import { e2ePorts } from "../shared/ports.mjs"

export default defineConfig({
  server: {
    port: e2ePorts.ssr.dev,
    strictPort: true,
    hmr: { port: e2ePorts.ssr.hmr },
  },
  /** One Node copy of `kiru` so the remote action registry matches `createRenderer({ actions })`. */
  ssr: {
    external: ["kiru"],
  },
  plugins: [
    kiru({
      router: {
        serverEntry: "./src/server.ts",
        ssg: true,
        remote: "**/*.remote.ts",
      },
    }),
  ],
})

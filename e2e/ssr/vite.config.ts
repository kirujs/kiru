import { defineConfig } from "vite"
import kiru from "vite-plugin-kiru"

export default defineConfig({
  /** One Node copy of `kiru` so the remote action registry matches `createRenderer({ actions })`. */
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
  ],
})

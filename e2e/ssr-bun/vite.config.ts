import { defineConfig } from "vite"
import kiru from "vite-plugin-kiru"

export default defineConfig({
  ssr: { external: ["kiru"] },
  plugins: [
    kiru({
      router: {
        adapter: "bun",
        serverEntry: "./src/server.ts",
        ssg: true,
      },
    }),
  ],
})

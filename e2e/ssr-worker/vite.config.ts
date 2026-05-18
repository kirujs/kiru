import { defineConfig } from "vite"
import kiru from "vite-plugin-kiru"

export default defineConfig({
  ssr: {
    noExternal: ["kiru", "@kirujs/adapter-cloudflare", "@kirujs/runtime"],
  },
  plugins: [
    kiru({
      router: {
        adapter: "cloudflare",
        serverEntry: "./src/worker.ts",
        ssg: true,
        images: { config: { strategy: "build" } },
      },
    }),
  ],
})

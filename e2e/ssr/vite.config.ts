import { defineConfig } from "vite"
import kiru from "vite-plugin-kiru"
import { imageStrategy } from "./src/imageConfig.js"

const useBuildImages = imageStrategy === "build"

export default defineConfig({
  /** One Node copy of `kiru` so the remote action registry matches `createRenderer({ actions })`. */
  ssr: {
    external: ["kiru"],
  },
  plugins: [
    kiru({
      router: {
        serverEntry: "./src/server.ts",
        ssg: true,
        remote: "**/*.actions.ts",
        ...(useBuildImages
          ? {
              images: {
                optimize: true,
                formats: ["webp"],
                config: { strategy: "build" },
              },
            }
          : {}),
      },
    }),
  ],
})

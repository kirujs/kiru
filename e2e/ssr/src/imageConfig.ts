import { defineImageConfig, type ImageOptimizationStrategy } from "kiru/image"

/**
 * `runtime` (default): on-demand `/_kiru/image` via `createImageOptimizerIfRuntime` on the server.
 * `build`: Vite `router.images` emits static variants; no optimizer route.
 *
 * Set `KIRU_IMAGE_STRATEGY=build` to exercise build-time processing in this app.
 */
export const imageStrategy = (process.env.KIRU_IMAGE_STRATEGY ??
  "runtime") as ImageOptimizationStrategy

export const imageConfig = defineImageConfig({
  strategy: imageStrategy,
  path: "/_kiru/image",
  localPatterns: [{ pathname: "/**" }],
  formats: ["image/avif", "image/webp"],
})

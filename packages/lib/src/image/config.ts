import type { ImageConfig, ImageOptimizationStrategy } from "./types.js"

export const DEFAULT_DEVICE_SIZES = [
  640, 750, 828, 1080, 1200, 1920, 2048, 3840,
] as const

export const DEFAULT_IMAGE_SIZES = [
  32, 48, 64, 96, 128, 256, 384,
] as const

export const DEFAULT_QUALITIES = [75] as const

const DEFAULT_CONFIG: ImageConfig = {
  strategy: "build",
  path: "/_kiru/image",
  deviceSizes: DEFAULT_DEVICE_SIZES,
  imageSizes: DEFAULT_IMAGE_SIZES,
  qualities: DEFAULT_QUALITIES,
  formats: ["image/webp"],
  localPatterns: [{ pathname: "/**" }],
  remotePatterns: [],
  minimumCacheTTL: 14_400,
  maximumRedirects: 3,
  maximumResponseBody: 50_000_000,
  maximumDiskCacheSize: undefined,
  unoptimized: false,
  dangerouslyAllowSVG: false,
  contentSecurityPolicy:
    "default-src 'self'; script-src 'none'; sandbox;",
  contentDispositionType: "attachment",
}

let activeConfig: ImageConfig = { ...DEFAULT_CONFIG }

export type DefineImageConfigInput = Partial<ImageConfig> & {
  strategy?: ImageOptimizationStrategy
}

/** Site / Vite image settings (see docs/router/kiru-image.md). */
export function defineImageConfig(
  input: DefineImageConfigInput = {}
): ImageConfig {
  activeConfig = {
    ...DEFAULT_CONFIG,
    ...input,
    deviceSizes: input.deviceSizes ?? DEFAULT_CONFIG.deviceSizes,
    imageSizes: input.imageSizes ?? DEFAULT_CONFIG.imageSizes,
    qualities: input.qualities ?? DEFAULT_CONFIG.qualities,
    formats: input.formats ?? DEFAULT_CONFIG.formats,
    localPatterns: input.localPatterns ?? DEFAULT_CONFIG.localPatterns,
    remotePatterns: input.remotePatterns ?? DEFAULT_CONFIG.remotePatterns,
  }
  return activeConfig
}

export function getImageConfig(): ImageConfig {
  return activeConfig
}

export function resetImageConfigForTests(): void {
  activeConfig = { ...DEFAULT_CONFIG }
}

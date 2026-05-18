import { getImageConfig } from "./config.js"
import type { ImageConfig, ImageLoader } from "./types.js"

/** Build-time manifest: logical src → width → emitted URL */
export type BuildImageManifest = Record<string, Record<number, string>>

let buildManifest: BuildImageManifest | null = null

export function setBuildImageManifest(manifest: BuildImageManifest | null): void {
  buildManifest = manifest
}

export function getBuildImageManifest(): BuildImageManifest | null {
  return buildManifest
}

export function createRuntimeImageLoader(config?: ImageConfig): ImageLoader {
  const { path } = config ?? getImageConfig()
  return ({ src, width, quality }) =>
    `${path}?url=${encodeURIComponent(src)}&w=${width}&q=${quality}`
}

export function createBuildImageLoader(manifest?: BuildImageManifest): ImageLoader {
  const map = manifest ?? buildManifest
  return ({ src, width }) => {
    const variants = map?.[src]
    if (variants) {
      const exact = variants[width]
      if (exact) return exact
      const widths = Object.keys(variants)
        .map(Number)
        .filter((w) => w >= width)
        .sort((a, b) => a - b)
      if (widths[0] !== undefined) return variants[widths[0]!]!
      const all = Object.keys(variants)
        .map(Number)
        .sort((a, b) => b - a)
      if (all[0] !== undefined) return variants[all[0]!]!
    }
    return src
  }
}

export function getDefaultImageLoader(config?: ImageConfig): ImageLoader {
  const cfg = config ?? getImageConfig()
  if (cfg.strategy === "unoptimized" || cfg.unoptimized) {
    return ({ src }) => src
  }
  if (cfg.strategy === "build") {
    return createBuildImageLoader()
  }
  return createRuntimeImageLoader(cfg)
}

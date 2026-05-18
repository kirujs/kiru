import type { ImageAsset } from "./types.js"

export function isImageAsset(src: string | ImageAsset): src is ImageAsset {
  return (
    typeof src === "object" &&
    src !== null &&
    "src" in src &&
    "width" in src &&
    "height" in src
  )
}

export function resolveImageSource(src: string | ImageAsset): {
  src: string
  width?: number
  height?: number
  blurDataURL?: string
} {
  if (isImageAsset(src)) {
    return {
      src: src.src,
      width: src.width,
      height: src.height,
      blurDataURL: src.blurDataURL,
    }
  }
  return { src }
}

export function isSvgSrc(src: string): boolean {
  const path = src.split("?")[0]?.split("#")[0] ?? src
  return path.toLowerCase().endsWith(".svg")
}

export function snapQuality(
  quality: number,
  allowed: readonly number[]
): number {
  if (allowed.length === 0) return quality
  if (allowed.includes(quality)) return quality
  let best = allowed[0]!
  let bestDist = Math.abs(quality - best)
  for (const q of allowed) {
    const dist = Math.abs(quality - q)
    if (dist < bestDist) {
      best = q
      bestDist = dist
    }
  }
  return best
}

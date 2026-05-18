import type { ImageConfig, ImageLoader } from "./types.js"

export function buildWidths(opts: {
  intrinsicWidth?: number
  deviceWidths: readonly number[]
  imageWidths: readonly number[]
  useImageSizes: boolean
}): number[] {
  const pool = opts.useImageSizes
    ? [...opts.deviceWidths, ...opts.imageWidths]
    : [...opts.deviceWidths]
  const unique = [...new Set(pool)].sort((a, b) => a - b)
  if (opts.intrinsicWidth === undefined) return unique
  const capped = unique.filter((w) => w <= opts.intrinsicWidth!)
  if (capped.length === 0 && opts.intrinsicWidth > 0) {
    return [opts.intrinsicWidth]
  }
  return capped
}

export function buildSrcSetEntries(opts: {
  src: string
  widths: readonly number[]
  quality: number
  loader: ImageLoader
  descriptor: "w" | "x"
  baseWidth?: number
}): string[] {
  const { src, loader, quality, descriptor } = opts
  if (descriptor === "x") {
    const w1 = opts.baseWidth ?? 0
    const w2 = w1 * 2
    const u1 = loader({ src, width: w1 || 1, quality })
    const u2 = loader({ src, width: w2 || 2, quality })
    return [`${u1} 1x`, `${u2} 2x`]
  }
  return opts.widths.map((w) => `${loader({ src, width: w, quality })} ${w}w`)
}

export function buildSrcSet(entries: string[]): string | undefined {
  if (entries.length === 0) return undefined
  return entries.join(", ")
}

export function pickDefaultSrc(opts: {
  overrideSrc?: string
  loader: ImageLoader
  src: string
  quality: number
  widths: readonly number[]
  baseWidth?: number
  descriptor: "w" | "x"
}): string {
  if (opts.overrideSrc) return opts.overrideSrc
  if (opts.descriptor === "x") {
    const w = opts.baseWidth ?? 1
    return opts.loader({ src: opts.src, width: w * 2, quality: opts.quality })
  }
  const max =
    opts.widths.length > 0
      ? opts.widths[opts.widths.length - 1]!
      : (opts.baseWidth ?? 1)
  return opts.loader({
    src: opts.src,
    width: max,
    quality: opts.quality,
  })
}

export function widthsForConfig(
  config: ImageConfig,
  sizes: string | undefined,
  intrinsicWidth?: number
): { widths: number[]; descriptor: "w" | "x" } {
  if (!sizes) {
    return { widths: [], descriptor: "x" }
  }
  return {
    widths: buildWidths({
      intrinsicWidth,
      deviceWidths: config.deviceSizes,
      imageWidths: config.imageSizes,
      useImageSizes: true,
    }),
    descriptor: "w",
  }
}

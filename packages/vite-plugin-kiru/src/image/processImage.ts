import path from "node:path"
import type sharp from "sharp"
import {
  BLUR_PLACEHOLDER_JPEG_QUALITY,
  BLUR_PLACEHOLDER_MAX_WIDTH,
} from "./constants.js"

export type SharpFactory = typeof sharp

export type ProcessImageOptions = {
  optimize: boolean
  deviceSizes: number[]
  quality: number
  formats: ("webp" | "avif")[]
  blurPlaceholderMaxWidth?: number
  blurPlaceholderQuality?: number
}

export type ImageVariantFile = {
  fileName: string
  buffer: Buffer
  width: number
  format: "webp" | "avif"
}

export type ProcessImageResult = {
  width: number
  height: number
  isAnimated: boolean
  blurDataURL?: string
  variantFiles: ImageVariantFile[]
}

export function pickVariantFormat(
  formats: ("webp" | "avif")[]
): "webp" | "avif" {
  return formats.includes("avif") ? "avif" : "webp"
}

export function widthsToGenerate(
  deviceSizes: number[],
  intrinsicWidth: number
): number[] {
  const capped = deviceSizes.filter((w) => w <= intrinsicWidth)
  if (capped.length === 0 && intrinsicWidth > 0) {
    capped.push(intrinsicWidth)
  }
  return capped
}

/** Build a tiny JPEG data URL for blur placeholders (LQIP). */
export async function buildBlurDataURL(
  sharpFn: SharpFactory,
  input: Buffer,
  opts?: { maxWidth?: number; quality?: number }
): Promise<string> {
  const maxWidth = opts?.maxWidth ?? BLUR_PLACEHOLDER_MAX_WIDTH
  const quality = opts?.quality ?? BLUR_PLACEHOLDER_JPEG_QUALITY
  const blurBuf = await sharpFn(input)
    .resize(maxWidth, undefined, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality })
    .toBuffer()
  return `data:image/jpeg;base64,${blurBuf.toString("base64")}`
}

export async function processImageAsset(
  sharpFn: SharpFactory,
  input: Buffer,
  filePath: string,
  options: ProcessImageOptions
): Promise<ProcessImageResult> {
  const meta = await sharpFn(input).metadata()
  const width = meta.width ?? 1
  const height = meta.height ?? 1
  const isAnimated = (meta.pages ?? 1) > 1

  const blurDataURL = isAnimated
    ? undefined
    : await buildBlurDataURL(sharpFn, input, {
        maxWidth: options.blurPlaceholderMaxWidth,
        quality: options.blurPlaceholderQuality,
      })

  const variantFiles: ImageVariantFile[] = []
  if (options.optimize && !isAnimated) {
    const base = path.basename(filePath, path.extname(filePath))
    const format = pickVariantFormat(options.formats)
    for (const w of widthsToGenerate(options.deviceSizes, width)) {
      const pipeline = sharpFn(input).resize(w, undefined, {
        fit: "inside",
        withoutEnlargement: true,
      })
      const buffer =
        format === "avif"
          ? await pipeline.avif({ quality: options.quality }).toBuffer()
          : await pipeline.webp({ quality: options.quality }).toBuffer()
      const outMeta = await sharpFn(buffer).metadata()
      variantFiles.push({
        fileName: `assets/${base}-${w}w.${format}`,
        buffer,
        width: outMeta.width ?? w,
        format,
      })
    }
  }

  return { width, height, isAnimated, blurDataURL, variantFiles }
}

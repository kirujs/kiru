import { getImageProps } from "./getImageProps.js"
import type { ImageConfig } from "./types.js"

/**
 * Build `<picture>` art-direction markup (Next.js pattern).
 * Returns HTML string for docs/tests; apps can use the same structure in JSX.
 */
export function buildArtDirectionPictureHtml(
  opts: {
    desktop: { src: string; width: number; height: number; quality?: number }
    mobile: { src: string; width: number; height: number; quality?: number }
    alt: string
    sizes?: string
  },
  config?: ImageConfig
): string {
  const common = { alt: opts.alt, sizes: opts.sizes ?? "100vw" }
  const desktop = getImageProps(
    { ...common, ...opts.desktop, quality: opts.desktop.quality ?? 80 },
    config
  )
  const mobile = getImageProps(
    { ...common, ...opts.mobile, quality: opts.mobile.quality ?? 70 },
    config
  )
  const rest = mobile.props
  const attrs = [
    `src="${escapeAttr(rest.src)}"`,
    `alt="${escapeAttr(rest.alt)}"`,
    rest.sizes ? `sizes="${escapeAttr(rest.sizes)}"` : "",
    `style="width:100%;height:auto;"`,
  ]
    .filter(Boolean)
    .join(" ")
  return (
    `<picture>` +
    `<source media="(min-width: 1000px)" srcset="${escapeAttr(desktop.props.srcSet ?? "")}" />` +
    `<source media="(min-width: 500px)" srcset="${escapeAttr(mobile.props.srcSet ?? "")}" />` +
    `<img ${attrs} />` +
    `</picture>`
  )
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;")
}

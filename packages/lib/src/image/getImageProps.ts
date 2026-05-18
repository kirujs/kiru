import { getImageConfig } from "./config.js"
import { getDefaultImageLoader } from "./loader.js"
import { isSvgSrc, resolveImageSource, snapQuality } from "./resolve.js"
import {
  buildSrcSet,
  buildSrcSetEntries,
  pickDefaultSrc,
  widthsForConfig,
} from "./srcset.js"
import type {
  ImageConfig,
  ImageImgProps,
  ImageLoader,
  ImagePreloadLink,
  ImageAsset,
} from "./types.js"

export type GetImagePropsOptions = {
  src: string | ImageAsset
  alt: string
  width?: number
  height?: number
  sizes?: string
  quality?: number
  loader?: ImageLoader
  unoptimized?: boolean
  overrideSrc?: string
  fill?: boolean
  placeholder?: "empty" | "blur" | (string & {})
  blurDataURL?: string
  /** LCP / above-fold: eager load, high fetch priority, and `<link rel="preload" as="image">` on SSR. */
  priority?: boolean
  loading?: "lazy" | "eager"
  decoding?: "async" | "auto" | "sync"
  class?: string
  style?: Record<string, string | number>
  onLoad?: (event: Event) => void
  onError?: (event: Event) => void
}

export type GetImagePropsResult = {
  props: ImageImgProps
  preloadLink?: ImagePreloadLink
}

export function getImageProps(
  options: GetImagePropsOptions,
  config?: ImageConfig
): GetImagePropsResult {
  const cfg = config ?? getImageConfig()
  const resolved = resolveImageSource(options.src)
  const width = options.width ?? resolved.width
  const height = options.height ?? resolved.height
  const blurDataURL = options.blurDataURL ?? resolved.blurDataURL

  const priority = options.priority ?? false
  const unoptimized =
    isSvgSrc(resolved.src) || options.unoptimized === true || cfg.unoptimized
  const quality = snapQuality(options.quality ?? 75, cfg.qualities)
  const loader = options.loader ?? getDefaultImageLoader(cfg)

  const loading =
    options.loading ?? (priority ? "eager" : "lazy")
  const decoding = options.decoding ?? "async"

  if (unoptimized) {
    const props: ImageImgProps = {
      src: options.overrideSrc ?? resolved.src,
      alt: options.alt,
      loading,
      decoding,
      class: options.class,
      style: options.style,
      onLoad: options.onLoad,
      onError: options.onError,
    }
    if (!options.fill) {
      if (width !== undefined) props.width = width
      if (height !== undefined) props.height = height
    }
    if (options.sizes) props.sizes = options.sizes
    if (priority) props.fetchPriority = "high"
    return {
      props,
      preloadLink: priority
        ? buildPreloadLink({
            href: props.src,
            sizes: options.sizes,
          })
        : undefined,
    }
  }

  const { widths, descriptor } = widthsForConfig(
    cfg,
    options.sizes,
    width
  )
  const entries = buildSrcSetEntries({
    src: resolved.src,
    widths,
    quality,
    loader,
    descriptor,
    baseWidth: width,
  })
  const srcSet = buildSrcSet(entries)
  const src = pickDefaultSrc({
    overrideSrc: options.overrideSrc,
    loader,
    src: resolved.src,
    quality,
    widths,
    baseWidth: width,
    descriptor,
  })

  const props: ImageImgProps = {
    src,
    alt: options.alt,
    loading,
    decoding,
    class: options.class,
    style: options.style,
    onLoad: options.onLoad,
    onError: options.onError,
  }
  if (srcSet) props.srcSet = srcSet
  if (options.sizes) props.sizes = options.sizes
  if (!options.fill) {
    if (width !== undefined) props.width = width
    if (height !== undefined) props.height = height
  }
  if (priority) props.fetchPriority = "high"

  void blurDataURL
  void options.placeholder

  return {
    props,
    preloadLink: priority
      ? buildPreloadLink({
          href: src,
          srcSet,
          sizes: options.sizes,
        })
      : undefined,
  }
}

function buildPreloadLink(opts: {
  href: string
  srcSet?: string
  sizes?: string
}): ImagePreloadLink {
  const link: ImagePreloadLink = {
    rel: "preload",
    as: "image",
    href: opts.href,
    fetchPriority: "high",
  }
  if (opts.srcSet) link.imageSrcSet = opts.srcSet
  if (opts.sizes) link.imageSizes = opts.sizes
  return link
}

/** Convert preload metadata to a route `head.links` row. */
export function imagePreloadToHeadLink(
  link: ImagePreloadLink
): Record<string, string> {
  const row: Record<string, string> = {
    rel: link.rel,
    as: link.as,
    href: link.href,
  }
  if (link.imageSrcSet) row.imagesrcset = link.imageSrcSet
  if (link.imageSizes) row.imagesizes = link.imageSizes
  if (link.fetchPriority) row.fetchpriority = link.fetchPriority
  return row
}

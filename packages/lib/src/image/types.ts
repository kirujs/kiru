export type ImageAsset = {
  src: string
  width: number
  height: number
  blurDataURL?: string
}

export type ImageLoader = (opts: {
  src: string
  width: number
  quality: number
}) => string

export type ImageOptimizationStrategy = "build" | "runtime" | "unoptimized"

export type ImagePattern = {
  protocol?: "http" | "https"
  hostname?: string
  port?: string
  pathname: string
  search?: string
}

export type ImageConfig = {
  strategy: ImageOptimizationStrategy
  path: string
  deviceSizes: readonly number[]
  imageSizes: readonly number[]
  qualities: readonly number[]
  formats: readonly string[]
  localPatterns: readonly ImagePattern[]
  remotePatterns: readonly ImagePattern[]
  minimumCacheTTL: number
  maximumRedirects: number
  maximumResponseBody: number
  maximumDiskCacheSize?: number
  unoptimized: boolean
  dangerouslyAllowSVG: boolean
  contentSecurityPolicy: string
  contentDispositionType: "inline" | "attachment"
}

export type ImagePreloadLink = {
  rel: "preload"
  as: "image"
  href: string
  imageSrcSet?: string
  imageSizes?: string
  fetchPriority?: "high"
}

export type ImageImgProps = {
  src: string
  alt: string
  width?: number
  height?: number
  sizes?: string
  srcSet?: string
  loading?: "lazy" | "eager"
  decoding?: "async" | "auto" | "sync"
  fetchPriority?: "high" | "low" | "auto"
  style?: Record<string, string | number>
  class?: string
  onLoad?: (event: Event) => void
  onError?: (event: Event) => void
}

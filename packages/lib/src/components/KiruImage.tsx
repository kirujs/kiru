import { setup } from "../hooks/index.js"
import { createElement } from "../element.js"

export type KiruImageProps = {
  /** Image URL. */
  src: string
  alt: string
  width: number
  height: number
  /** Responsive sizes hint for the browser. */
  sizes?: string
  /** @default 'lazy' */
  loading?: "lazy" | "eager"
  decoding?: "async" | "auto" | "sync"
  class?: string
}

/**
 * Image with explicit dimensions (CLS) and a simple 1x/2x `srcset`.
 *
 * @see docs/router/tier-3-wave-1.md#assets
 */
export const KiruImage: Kiru.Component<KiruImageProps> = () => {
  const $ = setup<typeof KiruImage>()
  const srcset = $.derive(({ src }) => `${src} 1x, ${src} 2x`)

  return ({
    src,
    alt,
    width,
    height,
    sizes,
    loading = "lazy",
    decoding = "async",
    class: className,
  }) =>
    createElement("img", {
      src,
      alt,
      width,
      height,
      sizes,
      loading,
      decoding,
      srcset,
      class: className,
    })
}

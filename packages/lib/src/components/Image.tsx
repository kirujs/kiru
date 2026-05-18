import { createElement } from "../element.js"
import { renderMode } from "../globals.js"
import { getImageConfig } from "../image/config.js"
import { getImageProps, type GetImagePropsOptions } from "../image/getImageProps.js"
import { registerImagePreload } from "../image/preloadRegistry.js"
import type { ImageAsset } from "../image/types.js"

export type ImageProps = Omit<GetImagePropsOptions, "src"> & {
  src: string | ImageAsset
}

/**
 * Image with explicit dimensions (CLS), responsive `srcset`, and optional blur placeholder.
 *
 * @see docs/router/kiru-image.md
 */
export const Image: Kiru.Component<ImageProps> = () => (props) => {
  const {
    fill,
    placeholder = "empty",
    blurDataURL,
    src,
    class: className,
    ...rest
  } = props

  const resolved = getImageProps(
    { src, ...rest, class: className },
    getImageConfig()
  )

  if (
    resolved.preloadLink &&
    (renderMode.current === "string" || renderMode.current === "stream")
  ) {
    registerImagePreload(resolved.preloadLink)
  }

  const blur =
    placeholder === "blur"
      ? blurDataURL ??
        (typeof src === "object" ? src.blurDataURL : undefined)
      : placeholder !== "empty" && typeof placeholder === "string"
        ? placeholder
        : undefined

  const imgStyle = fill
    ? {
        position: "absolute" as const,
        inset: 0,
        width: "100%",
        height: "100%",
        ...resolved.props.style,
      }
    : resolved.props.style

  const img = createElement("img", {
    ...resolved.props,
    class: className,
    style: imgStyle,
  })

  if (!blur && !fill) {
    return img
  }

  const children = blur ? [createBlurPlaceholder(blur), img] : [img]

  return createElement(
    "span",
    {
      style: fill
        ? { position: "relative", display: "block", overflow: "hidden" }
        : { position: "relative", display: "inline-block" },
    },
    ...children
  )
}

function createBlurPlaceholder(blur: string) {
  return createElement("img", {
    src: blur,
    alt: "",
    "aria-hidden": "true",
    style: {
      position: "absolute",
      inset: 0,
      width: "100%",
      height: "100%",
      objectFit: "cover",
      filter: "blur(20px)",
      transform: "scale(1.1)",
    },
  })
}

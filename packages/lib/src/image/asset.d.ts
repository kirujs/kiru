declare module "*.jpg" {
  import type { ImageAsset } from "kiru/image"
  const asset: ImageAsset
  export default asset
}

declare module "*.jpeg" {
  import type { ImageAsset } from "kiru/image"
  const asset: ImageAsset
  export default asset
}

declare module "*.png" {
  import type { ImageAsset } from "kiru/image"
  const asset: ImageAsset
  export default asset
}

declare module "*.webp" {
  import type { ImageAsset } from "kiru/image"
  const asset: ImageAsset
  export default asset
}

declare module "*.avif" {
  import type { ImageAsset } from "kiru/image"
  const asset: ImageAsset
  export default asset
}

declare module "*?kiru-img" {
  import type { ImageAsset } from "kiru/image"
  const asset: ImageAsset
  export default asset
}

declare module "virtual:kiru:image-config" {
  import type { DefineImageConfigInput } from "kiru/image"
  const config: DefineImageConfigInput
  export default config
}

declare module "virtual:kiru:image-manifest" {
  import type { BuildImageManifest } from "kiru/image"
  const manifest: BuildImageManifest
  export default manifest
}

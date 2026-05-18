import { defineImageConfig, type DefineImageConfigInput } from "./config.js"
import { setBuildImageManifest, type BuildImageManifest } from "./loader.js"

export type BootstrapImagePipelineOptions = {
  config?: DefineImageConfigInput
  manifest?: BuildImageManifest | null
}

/**
 * Wire image config + optional build manifest (from `virtual:kiru:image-manifest`).
 * Call once at app entry or via Vite `virtual:kiru:image-bootstrap`.
 */
function readManifestFromDom(): BuildImageManifest | null {
  if (typeof document === "undefined") return null
  const el = document.getElementById("kiru-image-manifest")
  if (!el?.textContent?.trim()) return null
  try {
    return JSON.parse(el.textContent) as BuildImageManifest
  } catch {
    return null
  }
}

export function bootstrapImagePipeline(
  options: BootstrapImagePipelineOptions = {}
): void {
  if (options.config) defineImageConfig(options.config)
  setBuildImageManifest(options.manifest ?? readManifestFromDom())
}

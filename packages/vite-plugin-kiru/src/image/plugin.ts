import fs from "node:fs/promises"
import path from "node:path"
import type { Plugin, ResolvedConfig } from "vite"
import { loadSharp } from "./loadSharp.js"
import { processImageAsset } from "./processImage.js"

const KIRU_IMG_QUERY = "?kiru-img"
export const VIRTUAL_IMAGE_BOOTSTRAP = "virtual:kiru:image-bootstrap"
export const VIRTUAL_IMAGE_MANIFEST = "virtual:kiru:image-manifest"
const MANIFEST_SCRIPT_ID = "kiru-image-manifest"
export const VIRTUAL_IMAGE_CONFIG = "virtual:kiru:image-config"
const ASSETS_META_FILE = "kiru-image-assets.json"

export type ImagePluginOptions = {
  enabled?: boolean
  /** Generate width variants at build (strategy build). */
  optimize?: boolean
  deviceSizes?: number[]
  qualities?: number[]
  formats?: ("webp" | "avif")[]
  /** Max width for JPEG blur placeholder (LQIP). Default 8 — not a variant width. */
  blurPlaceholderMaxWidth?: number
  /** JPEG quality for blur placeholder. Default 40. */
  blurPlaceholderQuality?: number
  /** Passed to `defineImageConfig` in the bootstrap virtual module. */
  config?: {
    strategy?: "build" | "runtime" | "unoptimized"
    path?: string
    unoptimized?: boolean
  }
}

type ImageAssetRecord = {
  src: string
  width: number
  height: number
  blurDataURL?: string
}

type VariantFile = { fileName: string; buffer: Buffer }

type StoredAssetEntry = {
  filePath: string
  asset: ImageAssetRecord
  variants: Record<number, string>
  variantFiles: VariantFile[]
}

/** Serialized to `kiru-image-assets.json` (buffers are not persisted). */
type StoredAssetDiskMeta = Omit<StoredAssetEntry, "variantFiles">

function relKey(projectRoot: string, filePath: string): string {
  return path.relative(projectRoot, filePath).replace(/\\/g, "/")
}

export function kiruImagePlugin(opts: ImagePluginOptions = {}): Plugin {
  const enabled = opts.enabled !== false
  const optimize = opts.optimize !== false
  const deviceSizes = opts.deviceSizes ?? [
    640, 750, 828, 1080, 1200, 1920,
  ]
  const quality = opts.qualities?.[0] ?? 75
  const formats = opts.formats ?? ["webp"]
  const imageConfig = {
    strategy: "build" as const,
    path: "/_kiru/image",
    unoptimized: false,
    ...opts.config,
  }

  const manifest: Record<string, Record<number, string>> = {}
  const assetByFile = new Map<string, StoredAssetEntry>()
  const processedAssets = new Map<string, string>()
  const entryCandidates = new Set<string>()
  let projectRoot = process.cwd()
  let outDir = "dist"
  let resolvedManifestSnapshot: Record<string, Record<number, string>> = {}

  const loadDiskAsset = async (filePath: string): Promise<string | null> => {
    const metaPath = path.join(projectRoot, outDir, ASSETS_META_FILE)
    try {
      const raw = JSON.parse(await fs.readFile(metaPath, "utf8")) as Record<
        string,
        StoredAssetDiskMeta
      >
      const key = relKey(projectRoot, filePath)
      const entry = raw[key] ?? raw[filePath]
      if (!entry) return null
      manifest[entry.asset.src] = entry.variants
      const moduleSource = `export default ${JSON.stringify(entry.asset)}`
      processedAssets.set(filePath, moduleSource)
      assetByFile.set(filePath, {
        ...entry,
        filePath,
        variantFiles: [],
      })
      return moduleSource
    } catch {
      return null
    }
  }

  return {
    name: "vite-plugin-kiru:image",
    enforce: "pre",
    configResolved(config: ResolvedConfig) {
      projectRoot = config.root
      outDir = config.build.outDir ?? "dist"
    },
    async buildStart() {
      if (!enabled) return
      await fs
        .unlink(path.join(projectRoot, outDir, ASSETS_META_FILE))
        .catch(() => {})
    },
    resolveId(id) {
      if (id === VIRTUAL_IMAGE_BOOTSTRAP) return `\0${VIRTUAL_IMAGE_BOOTSTRAP}`
      if (id === VIRTUAL_IMAGE_MANIFEST) return `\0${VIRTUAL_IMAGE_MANIFEST}`
      if (id === VIRTUAL_IMAGE_CONFIG) return `\0${VIRTUAL_IMAGE_CONFIG}`
      return null
    },
    async load(id) {
      if (id === `\0${VIRTUAL_IMAGE_CONFIG}`) {
        return `export default ${JSON.stringify(imageConfig)}`
      }
      if (id === `\0${VIRTUAL_IMAGE_BOOTSTRAP}`) {
        return [
          `import { bootstrapImagePipeline } from "kiru/image";`,
          `import imageConfig from "${VIRTUAL_IMAGE_CONFIG}";`,
          `bootstrapImagePipeline({ config: imageConfig });`,
        ].join("\n")
      }
      if (id === `\0${VIRTUAL_IMAGE_MANIFEST}`) {
        return `export default ${JSON.stringify(manifest)}`
      }

      if (!enabled || !id.includes(KIRU_IMG_QUERY)) return null
      const filePath = id.replace(KIRU_IMG_QUERY, "")
      const cached = processedAssets.get(filePath)
      if (cached) return cached

      const fromDisk = await loadDiskAsset(filePath)
      if (fromDisk) return fromDisk

      const sharp = loadSharp(projectRoot)
      if (!sharp) {
        throw new Error(
          "sharp is required for ?kiru-img imports. Install sharp in your project."
        )
      }
      const input = await fs.readFile(filePath)
      const processed = await processImageAsset(sharp, input, filePath, {
        optimize,
        deviceSizes,
        quality,
        formats,
        blurPlaceholderMaxWidth: opts.blurPlaceholderMaxWidth,
        blurPlaceholderQuality: opts.blurPlaceholderQuality,
      })

      const logicalSrc = `@kiru-img:${relKey(projectRoot, filePath)}`
      const originalFile = `assets/${path.basename(filePath)}`
      this.emitFile({
        type: "asset",
        fileName: originalFile,
        source: input,
      })

      const asset: ImageAssetRecord = {
        src: logicalSrc,
        width: processed.width,
        height: processed.height,
        blurDataURL: processed.blurDataURL,
      }
      const variantFiles: VariantFile[] = processed.variantFiles.map(
        ({ fileName, buffer }) => ({ fileName, buffer })
      )
      assetByFile.set(filePath, {
        filePath,
        asset,
        variants: {},
        variantFiles,
      })

      const moduleSource = `export default ${JSON.stringify(asset)}`
      processedAssets.set(filePath, moduleSource)
      return moduleSource
    },
    transform(code, id) {
      if (!enabled) return null
      const normalized = id.replace(/\\/g, "/")
      if (normalized.includes("/src/main.") || normalized.includes("/src/client.")) {
        entryCandidates.add(id)
      }
      if (id.includes("node_modules")) return null
      if (!/\.(tsx?|jsx?)$/.test(id)) return null

      let next = code
      if (/from\s+['"][^'"]+\.(png|jpe?g|gif|webp|avif)['"]/.test(code)) {
        next = next.replace(
          /from\s+(['"])(\.[^'"]+\.(png|jpe?g|gif|webp|avif))\1/gi,
          `from $1$2${KIRU_IMG_QUERY}$1`
        )
      }

      const isEntry =
        entryCandidates.has(id) && !next.includes("bootstrapImagePipeline")
      if (isEntry && optimize) {
        const bootstrap = [
          `import { bootstrapImagePipeline } from "kiru/image";`,
          `import imageConfig from "${VIRTUAL_IMAGE_CONFIG}";`,
          `bootstrapImagePipeline({ config: imageConfig });`,
        ].join("\n")
        next = `${next}\n${bootstrap}\n`
      }

      if (next === code) return null
      return { code: next, map: null }
    },
    generateBundle() {
      if (!enabled || assetByFile.size === 0) return

      for (const entry of assetByFile.values()) {
        if (Object.keys(entry.variants).length > 0) continue
        for (const { fileName, buffer } of entry.variantFiles) {
          this.emitFile({ type: "asset", fileName, source: buffer })
          const w = Number(fileName.match(/-(\d+)w\./)?.[1])
          if (w) entry.variants[w] = `/${fileName}`
        }
      }

      const resolvedManifest: Record<string, Record<string, string>> = {}
      const diskMeta: Record<string, StoredAssetDiskMeta> = {}

      for (const [filePath, entry] of assetByFile) {
        if (Object.keys(entry.variants).length > 0) {
          resolvedManifest[entry.asset.src] = entry.variants
        }
        diskMeta[relKey(projectRoot, filePath)] = {
          filePath: entry.filePath,
          asset: entry.asset,
          variants: entry.variants,
        }
      }

      Object.keys(manifest).forEach((k) => delete manifest[k])
      Object.assign(manifest, resolvedManifest)
      resolvedManifestSnapshot = resolvedManifest

      this.emitFile({
        type: "asset",
        fileName: "kiru-image-manifest.json",
        source: JSON.stringify(resolvedManifest, null, 2),
      })
      this.emitFile({
        type: "asset",
        fileName: ASSETS_META_FILE,
        source: JSON.stringify(diskMeta, null, 2),
      })
    },
    transformIndexHtml(html) {
      if (!enabled || Object.keys(resolvedManifestSnapshot).length === 0) {
        return html
      }
      const tag = `<script type="application/json" id="${MANIFEST_SCRIPT_ID}">${JSON.stringify(resolvedManifestSnapshot)}</script>`
      if (html.includes(`id="${MANIFEST_SCRIPT_ID}"`)) return html
      return html.replace("</head>", `    ${tag}\n  </head>`)
    },
  }
}

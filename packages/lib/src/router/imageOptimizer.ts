import fs from "node:fs/promises"
import path from "node:path"
import { getImageConfig } from "../image/config.js"
import { usesRuntimeImageOptimizer } from "../image/strategy.js"
import { isAllowedImageUrl } from "../image/patterns.js"
import { isSvgSrc, snapQuality } from "../image/resolve.js"
import type { ImageConfig } from "../image/types.js"

/** Minimal sharp surface used by the optimizer (internal). */
type SharpLike = {
  (input: Buffer): {
    metadata: () => Promise<{ width?: number; height?: number }>
    resize: (
      w: number,
      h: undefined,
      opts: { fit: string; withoutEnlargement: boolean }
    ) => {
      avif: (o: { quality: number }) => { toBuffer: () => Promise<Buffer> }
      webp: (o: { quality: number }) => { toBuffer: () => Promise<Buffer> }
      jpeg: (o: { quality: number }) => { toBuffer: () => Promise<Buffer> }
    }
  }
}

export type CreateImageOptimizerOptions = {
  /** Absolute path to static files root (Vite client output). */
  root: string
  config?: ImageConfig
  cacheDir?: string
  /**
   * Default export from `import sharp from "sharp"`.
   * Typed as `unknown` because sharp's overloads are not assignable to a narrow callable type.
   */
  sharp?: unknown
}

function asSharpLike(sharp: unknown): SharpLike {
  return sharp as SharpLike
}

type CacheEntry = { buffer: Buffer; contentType: string; at: number }

const memoryCache = new Map<string, CacheEntry>()

function cacheKey(url: string, w: number, q: number, format: string): string {
  return `${url}|${w}|${q}|${format}`
}

function pickFormat(accept: string | null, formats: readonly string[]): string {
  if (!accept) return formats[0] ?? "image/webp"
  for (const f of formats) {
    if (accept.includes(f)) return f
  }
  return formats[formats.length - 1] ?? "image/webp"
}

function qualityAllowed(q: number, allowed: readonly number[]): boolean {
  return allowed.includes(q)
}

async function readLocalFile(root: string, url: string): Promise<Buffer> {
  const rel = url.replace(/^\//, "").split("?")[0]!
  const filePath = path.join(root, rel)
  const resolved = path.resolve(filePath)
  const rootResolved = path.resolve(root)
  if (!resolved.startsWith(rootResolved + path.sep) && resolved !== rootResolved) {
    throw new Error("Path traversal")
  }
  return fs.readFile(resolved)
}

async function fetchRemote(
  url: string,
  config: ImageConfig
): Promise<Buffer> {
  let current = url
  let redirects = 0
  while (true) {
    const res = await fetch(current, { redirect: "manual" })
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location")
      if (!loc) throw new Error("Redirect without location")
      redirects++
      if (redirects > config.maximumRedirects) {
        throw new Error("Too many redirects")
      }
      current = new URL(loc, current).href
      continue
    }
    if (!res.ok) throw new Error(`Fetch failed: ${res.status}`)
    const len = res.headers.get("content-length")
    if (len && Number(len) > config.maximumResponseBody) {
      throw new Error("Response too large")
    }
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.byteLength > config.maximumResponseBody) {
      throw new Error("Response too large")
    }
    return buf
  }
}

async function loadSharp(injected?: unknown): Promise<SharpLike> {
  if (injected !== undefined) return asSharpLike(injected)
  try {
    const mod = await import("sharp")
    return mod.default as SharpLike
  } catch {
    throw new Error(
      "sharp is required for image optimization. Install sharp in your app and pass { sharp } to createImageOptimizer, or install sharp where Node can resolve it from the server cwd."
    )
  }
}

async function optimizeWithSharp(
  input: Buffer,
  width: number,
  quality: number,
  format: string,
  sharp: SharpLike
): Promise<{ buffer: Buffer; contentType: string }> {
  const pipeline = sharp(input).resize(width, undefined, {
    fit: "inside",
    withoutEnlargement: true,
  })
  if (format === "image/avif") {
    return {
      buffer: await pipeline.avif({ quality }).toBuffer(),
      contentType: "image/avif",
    }
  }
  if (format === "image/webp") {
    return {
      buffer: await pipeline.webp({ quality }).toBuffer(),
      contentType: "image/webp",
    }
  }
  return {
    buffer: await pipeline.jpeg({ quality }).toBuffer(),
    contentType: "image/jpeg",
  }
}

/**
 * On-demand optimizer handler when `defineImageConfig({ strategy: 'runtime' })`.
 * Returns `null` for `build` / `unoptimized` (use Vite `router.images` instead).
 */
export function createImageOptimizerIfRuntime(
  options: CreateImageOptimizerOptions
): ((request: Request) => Promise<Response | null>) | null {
  const config = options.config ?? getImageConfig()
  if (!usesRuntimeImageOptimizer(config)) return null
  return createImageOptimizer(options)
}

/**
 * Opt-in image optimization handler for Hono/Node servers.
 * Mount at `config.path` (default `/_kiru/image`).
 */
export function createImageOptimizer(
  options: CreateImageOptimizerOptions
): (request: Request) => Promise<Response | null> {
  const config = options.config ?? getImageConfig()
  const routePath = config.path.replace(/\/$/, "") || "/_kiru/image"
  let sharpPromise: Promise<SharpLike> | null = null
  const getSharp = () => {
    sharpPromise ??= loadSharp(options.sharp)
    return sharpPromise
  }

  return async (request: Request): Promise<Response | null> => {
    const url = new URL(request.url)
    if (url.pathname !== routePath) return null

    const src = url.searchParams.get("url")
    const w = Number(url.searchParams.get("w"))
    const q = Number(url.searchParams.get("q") ?? "75")

    if (!src || !Number.isFinite(w) || w <= 0) {
      return new Response("Bad Request", { status: 400 })
    }

    if (!qualityAllowed(q, config.qualities)) {
      return new Response("Bad Request", { status: 400 })
    }

    if (isSvgSrc(src) && !config.dangerouslyAllowSVG) {
      return new Response("Bad Request", { status: 400 })
    }

    const allowed = isAllowedImageUrl(
      src,
      config.localPatterns,
      config.remotePatterns
    )
    if (!allowed) {
      return new Response("Bad Request", { status: 400 })
    }

    const format = pickFormat(
      request.headers.get("accept"),
      config.formats
    )
    const key = cacheKey(src, w, q, format)
    const mem = memoryCache.get(key)
    if (mem) {
      return optimizedResponse(mem.buffer, mem.contentType, config)
    }

    if (options.cacheDir) {
      const diskPath = path.join(options.cacheDir, encodeCacheKey(key))
      try {
        const buffer = await fs.readFile(diskPath)
        const metaPath = `${diskPath}.meta`
        const meta = JSON.parse(
          await fs.readFile(metaPath, "utf8")
        ) as { contentType: string }
        return optimizedResponse(buffer, meta.contentType, config)
      } catch {
        // miss
      }
    }

    try {
      const input =
        allowed === "local"
          ? await readLocalFile(options.root, src)
          : await fetchRemote(src, config)

      const sharp = await getSharp()
      const { buffer, contentType } = await optimizeWithSharp(
        input,
        w,
        snapQuality(q, config.qualities),
        format,
        sharp
      )

      memoryCache.set(key, { buffer, contentType, at: Date.now() })

      if (options.cacheDir) {
        const diskPath = path.join(options.cacheDir, encodeCacheKey(key))
        await fs.mkdir(options.cacheDir, { recursive: true })
        await fs.writeFile(diskPath, buffer)
        await fs.writeFile(
          `${diskPath}.meta`,
          JSON.stringify({ contentType })
        )
      }

      return optimizedResponse(buffer, contentType, config)
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Optimization failed"
      return new Response(msg, { status: 500 })
    }
  }
}

function encodeCacheKey(key: string): string {
  return Buffer.from(key).toString("base64url")
}

function optimizedResponse(
  buffer: Buffer,
  contentType: string,
  config: ImageConfig
): Response {
  const headers = new Headers({
    "content-type": contentType,
    "content-length": String(buffer.byteLength),
    "cache-control": `public, max-age=${config.minimumCacheTTL}, immutable`,
    "content-security-policy": config.contentSecurityPolicy,
  })
  if (config.contentDispositionType === "attachment") {
    headers.set("content-disposition", "attachment")
  }
  return new Response(new Uint8Array(buffer), { status: 200, headers })
}

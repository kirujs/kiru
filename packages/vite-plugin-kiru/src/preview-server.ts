import fs from "node:fs"
import path from "node:path"
import type { ServerResponse } from "node:http"
import type { Connect } from "vite"
import {
  inferNotFoundStrategy,
  resolveHtmlAssetCandidates,
  type InferNotFoundStrategyInput,
  type NotFoundStrategy,
} from "kiru/router"

export { inferNotFoundStrategy, type NotFoundStrategy }

export function toPreviewPathname(url: string): string {
  return url.split("?")[0].split("#")[0] || "/"
}

export function isPreviewAssetPath(pathname: string): boolean {
  if (pathname.startsWith("/@") || pathname.startsWith("/__")) return true
  return /\.\w+$/.test(pathname) && !pathname.endsWith(".html")
}

/** Candidate on-disk HTML files for a public pathname (SSG / hybrid prerender output). */
export function htmlCandidates(outDir: string, pathname: string): string[] {
  return resolveHtmlAssetCandidates(pathname).map((candidate) => {
    const rel = candidate.replace(/^\/+/, "")
    return path.join(outDir, rel)
  })
}

function sendHtml(res: ServerResponse, status: number, filePath: string) {
  const body = fs.readFileSync(filePath)
  res.statusCode = status
  res.setHeader("content-type", "text/html; charset=utf-8")
  res.setHeader("content-length", body.byteLength)
  res.end(body)
}

/** True when the file is a completed prerender page, not the Vite HTML shell. */
export function isFilledPrerenderHtml(filePath: string): boolean {
  const snippet = fs.readFileSync(filePath, "utf8").slice(0, 16_384)
  return (
    !snippet.includes("{{kiru_body}}") && !snippet.includes("{{kiru_head}}")
  )
}

export type SsgPreviewOptions = {
  /**
   * Deploy-time behavior when no prerender file matches the pathname.
   * Inferred from router config when omitted.
   */
  notFoundStrategy?: NotFoundStrategy
  /**
   * @deprecated Use `notFoundStrategy: "hybrid-ssr"` instead.
   * When true, skip shell HTML and unknown paths (hybrid SSR + SSG).
   */
  requireFilledHtml?: boolean
}

function resolvePreviewNotFoundStrategy(
  options: SsgPreviewOptions
): NotFoundStrategy {
  if (options.notFoundStrategy) return options.notFoundStrategy
  if (options.requireFilledHtml === true) return "hybrid-ssr"
  if (options.requireFilledHtml === false) return "exact"
  return "exact"
}

export type PreviewRequest = {
  url?: string
  originalUrl?: string
  /** Set by {@link capturePreviewRequestUrl} before Vite SPA fallback rewrites `url`. */
  __kiruOriginalUrl?: string
}

export function capturePreviewRequestUrl(): Connect.NextHandleFunction {
  return (req, _res, next) => {
    const r = req as PreviewRequest
    if (!r.__kiruOriginalUrl) {
      r.__kiruOriginalUrl = r.originalUrl ?? r.url ?? "/"
    }
    next()
  }
}

export function previewPathname(req: PreviewRequest): string {
  return toPreviewPathname(req.__kiruOriginalUrl ?? req.originalUrl ?? req.url ?? "/")
}

export function createSsgPreviewMiddleware(
  outDir: string,
  options: SsgPreviewOptions = {}
): Connect.NextHandleFunction {
  const strategy = resolvePreviewNotFoundStrategy(options)
  const requireFilledHtml = strategy === "hybrid-ssr"

  return (req, res, next) => {
    try {
      const pathname = previewPathname(req)
      if (isPreviewAssetPath(pathname)) return next()

      for (const candidate of htmlCandidates(outDir, pathname)) {
        if (!fs.existsSync(candidate)) continue
        if (!fs.statSync(candidate).isFile()) continue
        if (requireFilledHtml && !isFilledPrerenderHtml(candidate)) {
          continue
        }
        sendHtml(res, 200, candidate)
        return
      }

      if (strategy === "exact") {
        const notFound = path.join(outDir, "404.html")
        if (fs.existsSync(notFound) && isFilledPrerenderHtml(notFound)) {
          sendHtml(res, 404, notFound)
          return
        }
      } else if (strategy === "csr-recovery") {
        const index = path.join(outDir, "index.html")
        if (fs.existsSync(index) && isFilledPrerenderHtml(index)) {
          sendHtml(res, 200, index)
          return
        }
      }

      next()
    } catch (err) {
      next(err)
    }
  }
}

export function previewNotFoundStrategyFromRouter(
  router: InferNotFoundStrategyInput
): NotFoundStrategy {
  return inferNotFoundStrategy(router)
}

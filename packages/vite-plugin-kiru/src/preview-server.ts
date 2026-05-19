import fs from "node:fs"
import path from "node:path"
import type { ServerResponse } from "node:http"
import type { Connect } from "vite"

export function toPreviewPathname(url: string): string {
  return url.split("?")[0].split("#")[0] || "/"
}

export function isPreviewAssetPath(pathname: string): boolean {
  if (pathname.startsWith("/@") || pathname.startsWith("/__")) return true
  return /\.\w+$/.test(pathname) && !pathname.endsWith(".html")
}

/** Candidate on-disk HTML files for a public pathname (SSG / hybrid prerender output). */
export function htmlCandidates(outDir: string, pathname: string): string[] {
  const clean = pathname.replace(/^\/+/, "")
  const joined = path.join(outDir, clean)
  const ext = path.extname(joined)

  if (ext === ".html") return [joined]
  if (ext) return []

  const candidates: string[] = []
  if (pathname.endsWith("/")) {
    candidates.push(path.join(joined, "index.html"))
  } else {
    candidates.push(`${joined}.html`)
    candidates.push(path.join(joined, "index.html"))
  }
  return candidates
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
   * When true (hybrid SSR + SSG), skip on-disk HTML that still contains
   * `{{kiru_*}}` placeholders so `vite preview` can render via the SSR bundle.
   */
  requireFilledHtml?: boolean
}

type PreviewRequest = {
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
  return (req, res, next) => {
    try {
      const pathname = previewPathname(req)
      if (isPreviewAssetPath(pathname)) return next()

      for (const candidate of htmlCandidates(outDir, pathname)) {
        if (!fs.existsSync(candidate)) continue
        if (options.requireFilledHtml && !isFilledPrerenderHtml(candidate)) {
          continue
        }
        sendHtml(res, 200, candidate)
        return
      }

      // Hybrid (SSR + SSG): only serve explicit prerender pages; unknown paths go to SSR.
      if (!options.requireFilledHtml) {
        const notFound = path.join(outDir, "404.html")
        if (fs.existsSync(notFound) && isFilledPrerenderHtml(notFound)) {
          sendHtml(res, 404, notFound)
          return
        }
      }
      next()
    } catch (err) {
      next(err)
    }
  }
}

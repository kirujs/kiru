import fs from "node:fs"
import path from "node:path"
import type { ServerResponse } from "node:http"
import type { Connect } from "vite"

function toPathname(url: string): string {
  return url.split("?")[0].split("#")[0] || "/"
}

function htmlCandidates(outDir: string, pathname: string): string[] {
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

export function createSsgPreviewMiddleware(
  outDir: string
): Connect.NextHandleFunction {
  return (req, res, next) => {
    try {
      const pathname = toPathname(req.url ?? "/")
      const ext = path.extname(pathname)
      if (ext && ext !== ".html") return next()

      for (const candidate of htmlCandidates(outDir, pathname)) {
        if (fs.existsSync(candidate)) {
          sendHtml(res, 200, candidate)
          return
        }
      }

      const notFound = path.join(outDir, "404.html")
      if (fs.existsSync(notFound)) {
        sendHtml(res, 404, notFound)
        return
      }
      next()
    } catch (err) {
      next(err)
    }
  }
}

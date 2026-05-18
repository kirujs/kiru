import { createReadStream } from "node:fs"
import { stat } from "node:fs/promises"
import { extname, resolve, sep } from "node:path"
import { Readable } from "node:stream"
import { isStaticAssetPathname } from "@kirujs/runtime"

const MIME_BY_EXT: Record<string, string> = {
  css: "text/css; charset=utf-8",
  gif: "image/gif",
  ico: "image/x-icon",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  js: "application/javascript; charset=utf-8",
  json: "application/json; charset=utf-8",
  map: "application/json; charset=utf-8",
  mjs: "application/javascript; charset=utf-8",
  png: "image/png",
  svg: "image/svg+xml",
  txt: "text/plain; charset=utf-8",
  webp: "image/webp",
  woff: "font/woff",
  woff2: "font/woff2",
  xml: "application/xml; charset=utf-8",
}

function contentTypeForPath(pathname: string): string {
  const ext = extname(pathname).slice(1).toLowerCase()
  return MIME_BY_EXT[ext] ?? "application/octet-stream"
}

function resolveSafePath(root: string, pathname: string): string | null {
  const rootResolved = resolve(root)
  const rel = pathname.replace(/^\/+/, "")
  const fileResolved = resolve(rootResolved, rel)
  const prefix = rootResolved.endsWith(sep) ? rootResolved : rootResolved + sep
  if (fileResolved !== rootResolved && !fileResolved.startsWith(prefix)) {
    return null
  }
  return fileResolved
}

/**
 * Serve a file under `root` when `pathname` is a static asset path
 * (`/assets/*`, extensioned files except `.html`).
 */
export async function serveStaticFile(
  root: string,
  pathname: string
): Promise<Response | null> {
  if (!isStaticAssetPathname(pathname)) return null

  const filePath = resolveSafePath(root, pathname)
  if (!filePath) return null

  let fileStat: Awaited<ReturnType<typeof stat>>
  try {
    fileStat = await stat(filePath)
  } catch {
    return null
  }
  if (!fileStat.isFile()) return null

  const body = Readable.toWeb(createReadStream(filePath)) as ReadableStream
  return new Response(body, {
    status: 200,
    headers: {
      "content-type": contentTypeForPath(pathname),
      "content-length": String(fileStat.size),
    },
  })
}

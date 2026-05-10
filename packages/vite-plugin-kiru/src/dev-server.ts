import { Readable } from "node:stream"
import type { IncomingMessage, ServerResponse } from "node:http"
import type { ViteDevServer, ModuleNode } from "vite"

// ─── CSS helpers ────────────────────────────────────────────────────────────

function extractEntryUrls(html: string): string[] {
  const urls: string[] = []
  const re =
    /<script\b[^>]*\btype=["']module["'][^>]*\bsrc=["']([^"']+)["'][^>]*>/g
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    const src = m[1]
    if (!src.startsWith("/@") && !src.startsWith("/__")) urls.push(src)
  }
  return urls
}

function gatherCssFromModule(root: ModuleNode): string[] {
  const seen = new Set<string>()
  const css: string[] = []
  const queue: ModuleNode[] = [root]
  while (queue.length > 0) {
    const mod = queue.shift()!
    if (!mod.id || seen.has(mod.id)) continue
    seen.add(mod.id)
    for (const dep of mod.importedModules) {
      const file = dep.file ?? ""
      if (file.endsWith(".css")) {
        css.push(dep.url)
      } else if (!file.includes("node_modules")) {
        queue.push(dep)
      }
    }
  }
  return css
}

async function collectDevCssUrls(
  server: ViteDevServer,
  html: string
): Promise<string[]> {
  const entryUrls = extractEntryUrls(html)
  if (entryUrls.length === 0) return []

  const existingHrefs = new Set<string>()
  const linkRe =
    /<link\b[^>]*\brel=["']stylesheet["'][^>]*\bhref=["']([^"']+)["'][^>]*>/g
  let m: RegExpExecArray | null
  while ((m = linkRe.exec(html)) !== null) existingHrefs.add(m[1])

  const cssUrls = new Set<string>()
  for (const url of entryUrls) {
    let mod = await server.moduleGraph.getModuleByUrl(url)
    if (!mod) {
      try {
        await server.transformRequest(url)
        mod = await server.moduleGraph.getModuleByUrl(url)
      } catch {
        // browser-only entry may fail to transform server-side — skip
      }
    }
    if (!mod) continue
    for (const cssUrl of gatherCssFromModule(mod)) {
      if (!existingHrefs.has(cssUrl)) cssUrls.add(cssUrl)
    }
  }
  return [...cssUrls]
}

export async function injectDevCssLinks(
  server: ViteDevServer,
  html: string
): Promise<string> {
  const urls = await collectDevCssUrls(server, html)
  if (urls.length === 0) return html
  const tags = urls
    .map((href) => `    <link rel="stylesheet" href="${href}">`)
    .join("\n")
  return html.replace("</head>", `${tags}\n  </head>`)
}

// ─── SSR request bridge ──────────────────────────────────────────────────────

/**
 * Convert a Node.js IncomingMessage into a Fetch API Request so we can call
 * a Hono app's `fetch` handler directly — giving us the Response object
 * before anything hits the socket, which lets us inject CSS cleanly.
 */
function nodeToFetchRequest(req: IncomingMessage): Request {
  const host = req.headers["host"] ?? "localhost"
  const url = `http://${host}${req.url ?? "/"}`

  const headers = new Headers()
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) continue
    if (Array.isArray(value)) value.forEach((v) => headers.append(key, v))
    else headers.set(key, value)
  }

  const method = (req.method ?? "GET").toUpperCase()
  const hasBody = method !== "GET" && method !== "HEAD" && method !== "OPTIONS"

  if (hasBody) {
    return new Request(url, {
      method,
      headers,
      // @ts-expect-error — `duplex` not yet in all Request typedefs
      body: Readable.toWeb(req),
      duplex: "half",
    })
  }
  return new Request(url, { method, headers })
}

/**
 * Kiru streaming SSR uses `ReadableStream<string>`; undici's
 * `response.text()` / `arrayBuffer()` only accept byte chunks. Read manually.
 */
async function readFetchBodyAsBuffer(response: Response): Promise<Buffer> {
  if (!response.body) return Buffer.alloc(0)
  const reader = response.body.getReader()
  const parts: Buffer[] = []
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    if (value === undefined || value === null) continue
    if (typeof value === "string") {
      parts.push(Buffer.from(value, "utf8"))
    } else if (value instanceof Uint8Array) {
      parts.push(Buffer.from(value))
    } else {
      throw new TypeError(
        `[vite-plugin-kiru] Unexpected response body chunk type: ${typeof value}`,
      )
    }
  }
  return Buffer.concat(parts)
}

/**
 * Write a Fetch API Response back to a Node.js ServerResponse, optionally
 * transforming HTML bodies (e.g. to inject CSS link tags).
 */
async function writeFetchResponse(
  response: Response,
  res: ServerResponse,
  transformHtml?: (html: string) => Promise<string>
): Promise<void> {
  const contentType = response.headers.get("content-type") ?? ""
  const isHtml =
    contentType.includes("text/html") ||
    (response.status >= 200 &&
      response.status < 300 &&
      contentType === "")

  let body: Buffer
  if (isHtml && transformHtml) {
    const html = (await readFetchBodyAsBuffer(response)).toString("utf8")
    const transformed = await transformHtml(html)
    body = Buffer.from(transformed, "utf8")
  } else {
    body = await readFetchBodyAsBuffer(response)
  }

  res.statusCode = response.status
  response.headers.forEach((value, key) => {
    if (key.toLowerCase() !== "content-length") res.setHeader(key, value)
  })
  res.setHeader("content-length", body.byteLength)
  res.end(body)
}

export interface SsrDevOptions {
  /**
   * Absolute path to the module that exports either:
   * - a Hono-style app as `default` with a `.fetch` method, or
   * - a `fetch(request: Request) => Response` function as the default export.
   */
  serverEntry: string
}

/**
 * Handle a single SSR dev request by loading the user's server module fresh via
 * ssrLoadModule (so HMR invalidation is respected), calling `default.fetch` or
 * `default` as a fetch handler, injecting render-blocking CSS links into HTML
 * responses, then writing the
 * result back to the Node.js response.
 *
 * Returns `true` if the request was handled, `false` to let the next
 * middleware run (e.g. for plain-text 404s where no kiru route matched).
 */
export async function handleSsrDevRequest(
  server: ViteDevServer,
  req: IncomingMessage,
  res: ServerResponse,
  opts: SsrDevOptions
): Promise<boolean> {
  const appMod = await server.ssrLoadModule(opts.serverEntry)
  const exported = appMod?.default as
    | { fetch?: typeof fetch }
    | typeof fetch
    | undefined

  const fetchReq = nodeToFetchRequest(req)
  let response: Response

  if (
    exported &&
    typeof exported === "object" &&
    typeof exported.fetch === "function"
  ) {
    response = await exported.fetch(fetchReq)
  } else if (typeof exported === "function") {
    response = await (exported as (r: Request) => Response | Promise<Response>)(
      fetchReq
    )
  } else {
    return false
  }

  // If the Hono app couldn't match a route it returns a plain-text 404.
  // Pass those through so Vite's own error overlay can handle them.
  if (
    response.status === 404 &&
    !response.headers.get("content-type")?.includes("text/html")
  ) {
    return false
  }

  await writeFetchResponse(response, res, (html) =>
    injectDevCssLinks(server, html)
  )
  return true
}

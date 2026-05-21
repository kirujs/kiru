import {
  bindClientDisconnectAbort,
  nodeRequestToFetch,
} from "@kirujs/adapter-node"
import type { IncomingMessage, ServerResponse } from "node:http"
import type { ViteDevServer, ModuleNode } from "vite"
import { resolveDefaultFetch } from "./fetchResponse.js"

// ─── CSS helpers ────────────────────────────────────────────────────────────

/**
 * Extract `src` URLs from `<script type="module" src="…">` tags. Used to
 * discover the application's entry script(s) — typically `/src/client.tsx` —
 * so we can walk Vite's module graph for CSS dependencies.
 */
export function extractEntryUrls(html: string): string[] {
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

function extractExistingStylesheetHrefs(html: string): Set<string> {
  const hrefs = new Set<string>()
  const re =
    /<link\b[^>]*\brel=["']stylesheet["'][^>]*\bhref=["']([^"']+)["'][^>]*>/g
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) hrefs.add(m[1])
  return hrefs
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

async function collectDevCssUrlsForEntries(
  server: ViteDevServer,
  entryUrls: string[],
  existingHrefs: Set<string>
): Promise<string[]> {
  if (entryUrls.length === 0) return []
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

function formatCssLinkTags(urls: string[]): string {
  if (urls.length === 0) return ""
  return urls
    .map((href) => `<link rel="stylesheet" href="${href}">`)
    .join("\n    ")
}

/**
 * Inject dev-mode CSS link tags into a full HTML string. Used by the SSG dev
 * path which already has the entire rendered document in memory.
 */
export async function injectDevCssLinks(
  server: ViteDevServer,
  html: string
): Promise<string> {
  const entryUrls = extractEntryUrls(html)
  if (entryUrls.length === 0) return html
  const existing = extractExistingStylesheetHrefs(html)
  const cssUrls = await collectDevCssUrlsForEntries(server, entryUrls, existing)
  const tags = formatCssLinkTags(cssUrls)
  if (!tags) return html
  return html.replace("</head>", `${tags}\n  </head>`)
}

/**
 * Resolve dev-mode CSS link tags for the streaming SSR path.
 *
 * The streaming SSR response carries the entry `<script type="module">` in
 * the template *suffix*, which only flushes after the synchronous body
 * render. We therefore can't extract entries from the response in time to
 * inject CSS into the head — caller passes the pre-resolved entry URLs
 * (cached from the static `index.html` template) instead.
 *
 * Returns the formatted `<link rel="stylesheet">` tags, or `""` when no CSS
 * needs to be injected.
 */
async function resolveDevCssLinkTagsForEntries(
  server: ViteDevServer,
  entryUrls: string[]
): Promise<string> {
  if (entryUrls.length === 0) return ""
  const cssUrls = await collectDevCssUrlsForEntries(
    server,
    entryUrls,
    new Set()
  )
  return formatCssLinkTags(cssUrls)
}

// ─── Response writers ────────────────────────────────────────────────────────

const HEAD_CLOSE_RE = /<\/head\s*>/i
const HEAD_LOOKAHEAD_CAP_BYTES = 256 * 1024

function chunkToString(value: unknown, decoder: TextDecoder): string {
  if (typeof value === "string") return value
  if (value instanceof Uint8Array) {
    return decoder.decode(value, { stream: true })
  }
  return ""
}

function applyResponseHeaders(response: Response, res: ServerResponse): void {
  res.statusCode = response.status
  response.headers.forEach((value, key) => {
    if (key.toLowerCase() === "content-length") return
    res.setHeader(key, value)
  })
}

async function pipeReaderRaw(
  reader: ReadableStreamDefaultReader<unknown>,
  res: ServerResponse,
  renderSignal?: AbortSignal
): Promise<void> {
  while (true) {
    if (renderSignal?.aborted) {
      await reader.cancel()
      break
    }
    const { done, value } = await reader.read()
    if (done) break
    if (typeof value === "string") {
      res.write(value)
    } else if (value instanceof Uint8Array) {
      res.write(Buffer.from(value))
    }
  }
}

/**
 * Stream a Fetch Response to a Node ServerResponse, preserving chunked
 * delivery so streaming SSR actually streams in dev. For HTML responses,
 * the first occurrence of `</head>` triggers a one-shot head-injection
 * callback (used to add dev CSS link tags); every subsequent chunk is
 * forwarded verbatim with no further inspection.
 *
 * The pre-`</head>` buffer is bounded by {@link HEAD_LOOKAHEAD_CAP_BYTES};
 * if the close tag never arrives, the buffered prefix is flushed as-is and
 * injection is skipped — the response is never held back indefinitely.
 */
async function streamFetchResponseToNode(
  response: Response,
  res: ServerResponse,
  injectHeadHtml?: () => Promise<string>,
  renderSignal?: AbortSignal
): Promise<void> {
  applyResponseHeaders(response, res)

  if (!response.body) {
    res.end()
    return
  }

  const contentType = response.headers.get("content-type") ?? ""
  const isHtml =
    contentType.includes("text/html") ||
    (response.status >= 200 &&
      response.status < 300 &&
      contentType === "")

  const reader = response.body.getReader()
  try {
    if (!isHtml || !injectHeadHtml) {
      await pipeReaderRaw(reader, res, renderSignal)
      return
    }

    const decoder = new TextDecoder("utf-8", { fatal: false })
    let headBuffer = ""
    let injected = false

    while (true) {
      if (renderSignal?.aborted) {
        await reader.cancel()
        break
      }
      const { done, value } = await reader.read()
      if (done) break
      const text = chunkToString(value, decoder)
      if (!text) continue

      if (injected) {
        res.write(text)
        continue
      }

      headBuffer += text
      const match = HEAD_CLOSE_RE.exec(headBuffer)
      if (match) {
        const tags = await injectHeadHtml()
        const insertion = tags ? `${tags}\n    ` : ""
        res.write(
          headBuffer.slice(0, match.index) +
            insertion +
            headBuffer.slice(match.index)
        )
        headBuffer = ""
        injected = true
      } else if (headBuffer.length > HEAD_LOOKAHEAD_CAP_BYTES) {
        // `</head>` is suspiciously far away — give up and pass through.
        res.write(headBuffer)
        headBuffer = ""
        injected = true
      }
    }

    // Flush any remaining decoder state and pending buffer.
    const tail = decoder.decode()
    if (injected) {
      if (tail) res.write(tail)
    } else {
      if (tail) headBuffer += tail
      if (headBuffer) res.write(headBuffer)
    }
  } finally {
    reader.releaseLock()
    res.end()
  }
}

// ─── Public entry point ──────────────────────────────────────────────────────

export interface SsrDevOptions {
  /**
   * Absolute path to the module that exports either:
   * - a Hono-style app as `default` with a `.fetch` method, or
   * - a `fetch(request: Request) => Response` function as the default export.
   */
  serverEntry: string
  /**
   * Returns the application's entry script URLs (e.g. `["/src/client.tsx"]`).
   * These are walked through Vite's module graph to gather CSS that needs to
   * be link-injected into `<head>` to prevent FOUC in dev. The caller is
   * expected to derive these from the static HTML template once and cache
   * them — reading them on every chunk would force re-buffering.
   */
  getEntryUrls: () => Promise<string[]>
  /**
   * Loads dev-only side-effect modules before the app handles the request.
   * Used for remote action registration so action POSTs see hot updates even
   * when no page module has been refreshed in the browser.
   */
  loadRemoteRegistry?: () => Promise<void>
  /**
   * Loads dev-only side-effect modules so server-loader POSTs are registered
   * even when the target route has not been SSR-rendered yet.
   */
  loadLoaderRegistry?: () => Promise<void>
  /**
   * Raw HTML snippets for `<head>` (e.g. Kiru devtools + transformIndexHtml delta),
   * injected before dev CSS link tags.
   */
  getHeadInjection?: () => Promise<string>
}

/**
 * Handle a single SSR dev request by loading the user's server module fresh via
 * `ssrLoadModule` (so HMR invalidation is respected), calling `default.fetch`
 * or `default` as a fetch handler, and streaming the result back to the Node
 * response with render-blocking CSS links injected into `<head>` on the fly.
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
  await opts.loadRemoteRegistry?.()
  await opts.loadLoaderRegistry?.()
  const appMod = await server.ssrLoadModule(opts.serverEntry)
  const fetch = resolveDefaultFetch(appMod?.default)
  if (!fetch) return false

  const { request: fetchReq, abort } = nodeRequestToFetch(req)
  const unbind = bindClientDisconnectAbort(res, abort)
  let response: Response
  try {
    response = await fetch(fetchReq)
  } catch (err) {
    unbind()
    if (abort.signal.aborted) return false
    throw err
  }

  // If the Hono app couldn't match a route it returns a plain-text 404.
  // Pass those through so Vite's own error overlay can handle them.
  if (
    response.status === 404 &&
    !response.headers.get("content-type")?.includes("text/html")
  ) {
    unbind()
    return false
  }

  try {
  await streamFetchResponseToNode(response, res, async () => {
    const chunks: string[] = []
    const headInjection = await opts.getHeadInjection?.()
    if (headInjection) chunks.push(headInjection)
    const entryUrls = await opts.getEntryUrls()
    const cssTags = await resolveDevCssLinkTagsForEntries(server, entryUrls)
    if (cssTags) chunks.push(cssTags)
    return chunks.join("\n    ")
  }, abort.signal)
  return true
  } finally {
    unbind()
  }
}

import { existsSync, readFileSync } from "node:fs"
import { extname, join } from "node:path"
import type { CustomRequestContext } from "./types.js"
import {
  REQUEST_CONTEXT_SCRIPT_ID,
  serializeKiruRequestTokenScript,
  serializeRequestContextScript,
} from "./requestContext.js"

/** Same shape as paths from {@link generateStaticPaths} / the route manifest. */
export function normalizeRoutePathname(urlOrPath: string): string {
  const raw = urlOrPath.split("?")[0].split("#")[0] || "/"
  if (raw === "/") return "/"
  return "/" + raw.split("/").filter(Boolean).join("/")
}

/**
 * Candidate filesystem paths for a prerendered HTML page under `clientDir`,
 * matching `vite-plugin-kiru` SSG output and `createSsgPreviewMiddleware`.
 */
export function prerenderedHtmlCandidates(
  clientDir: string,
  pathname: string
): string[] {
  const pathnameOnly = normalizeRoutePathname(pathname)
  const clean = pathnameOnly.replace(/^\/+/, "")
  const joined = join(clientDir, clean)
  const ext = extname(joined)

  if (ext === ".html") return [joined]
  if (ext) return []

  const candidates: string[] = []
  if (pathnameOnly.endsWith("/")) {
    candidates.push(join(joined, "index.html"))
  } else {
    candidates.push(`${joined}.html`)
    candidates.push(join(joined, "index.html"))
  }
  return candidates
}

export interface TryReadPrerenderedHtmlOptions {
  /**
   * When set, only read from disk if the normalized pathname is in this set
   * (for example `new Set(await generateStaticPaths(compileRouteTree(routes)))`).
   * Use this when the client output also contains an unfilled `index.html`
   * shell for SSR-only routes (e.g. `/` is dynamic).
   */
  staticPaths?: ReadonlySet<string>
}

/**
 * Read prerendered HTML from the Vite client output directory, if a matching
 * file exists. Returns `null` when nothing was emitted for this path (caller
 * should fall through to SSR).
 *
 * Prefer passing {@link TryReadPrerenderedHtmlOptions.staticPaths} from
 * {@link generateStaticPaths} whenever the build leaves a template `index.html`
 * in `clientDir` for SSR routes.
 */
export function tryReadPrerenderedHtml(
  clientDir: string,
  pathname: string,
  options?: TryReadPrerenderedHtmlOptions
): string | null {
  const pathnameOnly = normalizeRoutePathname(pathname)
  if (options?.staticPaths && !options.staticPaths.has(pathnameOnly)) {
    return null
  }

  for (const candidate of prerenderedHtmlCandidates(clientDir, pathnameOnly)) {
    if (existsSync(candidate)) {
      return readFileSync(candidate, "utf8")
    }
  }
  return null
}

const HEAD_CLOSE_RE = /<\/head\s*>/i
const BODY_OPEN_RE = /<body\b[^>]*>/i

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/** Removes Kiru request-context and action-token `<script>` tags from full HTML. */
export function stripPrerenderedRequestInjections(html: string): string {
  let out = html
  const ctxId = escapeRegExp(REQUEST_CONTEXT_SCRIPT_ID)
  out = out.replace(
    new RegExp(
      `<script\\b[^>]*\\bid=["']${ctxId}["'][^>]*>[\\s\\S]*?<\\/script>`,
      "gi"
    ),
    ""
  )
  out = out.replace(
    /<script\b[^>]*\bk-request-token\b[^>]*>[\s\S]*?<\/script>/gi,
    ""
  )
  return out
}

/**
 * Replaces build-time request context / action token in prerendered HTML with
 * values for the current request (production hybrid: disk HTML + per-request ctx).
 */
export function hydratePrerenderedHtmlForRequest(
  html: string,
  requestContext: CustomRequestContext | null,
  actionsSecret: string | undefined
): string {
  const stripped = stripPrerenderedRequestInjections(html)
  const parts: string[] = []
  const ctxScript = serializeRequestContextScript(requestContext)
  if (ctxScript) parts.push(ctxScript)
  if (actionsSecret) {
    const tokenScript = serializeKiruRequestTokenScript(
      requestContext,
      actionsSecret
    )
    if (tokenScript) parts.push(tokenScript)
  }
  if (parts.length === 0) return stripped

  const insertion = `\n    ${parts.join("\n    ")}`
  const headMatch = HEAD_CLOSE_RE.exec(stripped)
  if (headMatch) {
    const i = headMatch.index ?? 0
    return stripped.slice(0, i) + insertion + stripped.slice(i)
  }
  const bodyMatch = BODY_OPEN_RE.exec(stripped)
  if (bodyMatch) {
    const j = (bodyMatch.index ?? 0) + bodyMatch[0].length
    return stripped.slice(0, j) + insertion + stripped.slice(j)
  }
  return stripped + insertion
}

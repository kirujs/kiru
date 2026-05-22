import type { RouteMatch } from "./types.js"

/** Vite client manifest chunk entry (subset). */
export type ViteManifestChunk = {
  file?: string
  imports?: string[]
  isEntry?: boolean
}

export type ViteClientManifest = Record<string, ViteManifestChunk>

export type HydrationChunksManifest = {
  version: 1
  /** Hashed client entry chunk URL path (e.g. `/assets/index-abc.js`). */
  entry?: string
  /**
   * Static import closure of the client entry (shared runtime: jsx, link, etc.).
   * Preloaded early with `fetchpriority="low"` so they do not compete with LCP.
   */
  bootstrap?: string[]
  /** Vite module key → absolute chunk URL paths for that module and its static imports. */
  modules: Record<string, string[]>
  /** Compiled route id (`route:N`) → chunk URL paths for first paint / hover. */
  byRouteId: Record<string, string[]>
  /** App pathname (`/about`) → chunk URL paths. */
  byPathname: Record<string, string[]>
}

const injectedPreloadHrefs = new Set<string>()

export function resetInjectedModulePreloadsForTests(): void {
  injectedPreloadHrefs.clear()
}

export function getInjectedModulePreloadHrefs(): ReadonlySet<string> {
  return injectedPreloadHrefs
}

function chunkUrlFromManifest(
  manifest: ViteClientManifest,
  key: string
): string | undefined {
  const entry = manifest[key]
  const file = entry?.file
  if (!file || !file.endsWith(".js")) return undefined
  return `/${file}`
}

/**
 * Walk Vite manifest `imports` (chunk keys or source keys) and collect `.js` asset URLs.
 */
export function resolveModuleChunkUrls(
  manifest: ViteClientManifest,
  moduleKey: string,
  visited = new Set<string>()
): string[] {
  if (visited.has(moduleKey)) return []
  visited.add(moduleKey)

  const urls: string[] = []
  const direct = chunkUrlFromManifest(manifest, moduleKey)
  if (direct) urls.push(direct)

  const entry = manifest[moduleKey]
  if (!entry?.imports) return urls

  for (const imp of entry.imports) {
    if (imp === "index.html") continue
    urls.push(...resolveModuleChunkUrls(manifest, imp, visited))
  }
  return urls
}

/** Entry `index.html` static imports — shared runtime before the entry module executes. */
export function resolveEntryBootstrapUrls(
  manifest: ViteClientManifest
): string[] {
  const entry = resolveEntryChunkUrl(manifest)
  const urls = resolveModuleChunkUrls(manifest, "index.html")
  if (!entry) return [...new Set(urls)]
  return [...new Set(urls.filter((u) => u !== entry))]
}

export function resolveEntryChunkUrl(
  manifest: ViteClientManifest
): string | undefined {
  const fromHtml = chunkUrlFromManifest(manifest, "index.html")
  if (fromHtml) return fromHtml
  for (const [key, chunk] of Object.entries(manifest)) {
    if (chunk.isEntry && chunk.file) {
      const url = chunkUrlFromManifest(manifest, key)
      if (url) return url
    }
  }
  return undefined
}

export function resolveModuleKeysChunkUrls(
  manifest: ViteClientManifest,
  moduleKeys: Iterable<string>,
  options?: { excludeEntry?: string }
): string[] {
  const out = new Set<string>()
  for (const key of moduleKeys) {
    for (const url of resolveModuleChunkUrls(manifest, key)) {
      if (options?.excludeEntry && url === options.excludeEntry) continue
      out.add(url)
    }
  }
  return [...out]
}

export function collectChunkUrlsForMatch(
  match: RouteMatch,
  chunks: HydrationChunksManifest | undefined
): string[] {
  if (!chunks) return []
  const fromId = chunks.byRouteId[match.route.id]
  if (fromId?.length) return fromId
  const fromPath = chunks.byPathname[match.route.path]
  if (fromPath?.length) return fromPath
  return []
}

/** Shared entry-runtime chunks (Vite vendor slices). Low priority vs route chunks. */
export function formatBootstrapPreloadLinks(urls: Iterable<string>): string {
  const parts: string[] = []
  for (const href of urls) {
    if (!href) continue
    parts.push(
      `<link rel="modulepreload" crossorigin href="${escapeAttr(href)}" fetchpriority="low">`
    )
  }
  return parts.length ? `\n    ${parts.join("\n    ")}` : ""
}

/** Route layout/page chunks for the active navigation. */
export function formatRouteModulePreloadLinks(urls: Iterable<string>): string {
  const parts: string[] = []
  for (const href of urls) {
    if (!href) continue
    parts.push(
      `<link rel="modulepreload" crossorigin href="${escapeAttr(href)}">`
    )
  }
  return parts.length ? `\n    ${parts.join("\n    ")}` : ""
}

/** @deprecated Use formatRouteModulePreloadLinks */
export function formatModulePreloadLinks(urls: Iterable<string>): string {
  return formatRouteModulePreloadLinks(urls)
}

export function renderModulePreloadLinks(
  urls: Iterable<string>,
  options?: { skipHrefs?: ReadonlySet<string>; trackInjected?: boolean }
): string {
  const skip = options?.skipHrefs ?? injectedPreloadHrefs
  const track = options?.trackInjected ?? true
  const parts: string[] = []
  for (const href of urls) {
    if (!href || skip.has(href)) continue
    parts.push(
      `<link rel="modulepreload" crossorigin href="${escapeAttr(href)}">`
    )
    if (track) injectedPreloadHrefs.add(href)
  }
  return parts.length ? `\n    ${parts.join("\n    ")}` : ""
}

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
}

/** Inject modulepreload links into `document.head` (client navigations / Link hover). */
export function injectModulePreloadsInDocument(
  urls: Iterable<string>
): void {
  if (typeof document === "undefined") return
  for (const href of urls) {
    if (!href || injectedPreloadHrefs.has(href)) continue
    const link = document.createElement("link")
    link.rel = "modulepreload"
    link.href = href
    link.crossOrigin = "anonymous"
    document.head.appendChild(link)
    injectedPreloadHrefs.add(href)
  }
}

let clientHydrationChunks: HydrationChunksManifest | undefined

export function setClientHydrationChunksManifest(
  manifest: HydrationChunksManifest | undefined
): void {
  clientHydrationChunks = manifest
}

export function getClientHydrationChunksManifest():
  | HydrationChunksManifest
  | undefined {
  return clientHydrationChunks
}

export async function loadClientHydrationChunksManifest(
  url = "/kiru-route-chunks.json"
): Promise<HydrationChunksManifest | undefined> {
  if (typeof fetch === "undefined") return undefined
  try {
    const res = await fetch(url, { credentials: "same-origin" })
    if (!res.ok) return undefined
    const data = (await res.json()) as HydrationChunksManifest
    if (data?.version !== 1) return undefined
    clientHydrationChunks = data
    return data
  } catch {
    return undefined
  }
}

export function preloadChunksForMatch(match: RouteMatch): void {
  const urls = collectChunkUrlsForMatch(
    match,
    getClientHydrationChunksManifest()
  )
  injectModulePreloadsInDocument(urls)
}

export function routePreloadUrlsExcludingBootstrap(
  routeUrls: Iterable<string>,
  bootstrap: Iterable<string> | undefined
): string[] {
  const boot = new Set(bootstrap)
  return [...new Set(routeUrls)].filter((u) => !boot.has(u))
}

export function appendHydrationPreloadsToHeadHtml(
  headHtml: string,
  input: {
    bootstrap?: string[]
    route?: string[]
  }
): string {
  const boot = input.bootstrap ?? []
  const route = routePreloadUrlsExcludingBootstrap(input.route ?? [], boot)
  const links = formatBootstrapPreloadLinks(boot) + formatRouteModulePreloadLinks(route)
  return links ? headHtml + links : headHtml
}

export function appendModulePreloadsToHeadHtml(
  headHtml: string,
  urls: string[]
): string {
  return appendHydrationPreloadsToHeadHtml(headHtml, { route: urls })
}

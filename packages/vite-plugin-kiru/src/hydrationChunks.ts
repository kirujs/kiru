import path from "node:path"
import { resolveEntryBootstrapUrls } from "kiru/router"

export const ROUTE_CHUNKS_MANIFEST = "kiru-route-chunks.json"

export type ViteManifestChunk = {
  file?: string
  imports?: string[]
  isEntry?: boolean
}

export type ViteClientManifest = Record<string, ViteManifestChunk>

export type HydrationChunksManifest = {
  version: 1
  entry?: string
  bootstrap?: string[]
  modules: Record<string, string[]>
  byRouteId: Record<string, string[]>
  byPathname: Record<string, string[]>
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

function resolveEntryChunkUrl(
  manifest: ViteClientManifest
): string | undefined {
  const fromHtml = manifest["index.html"]
  if (fromHtml?.file) return `/${fromHtml.file}`
  for (const chunk of Object.values(manifest)) {
    if (chunk.isEntry && chunk.file) return `/${chunk.file}`
  }
  return undefined
}

function normalizeModuleKey(
  specifier: string,
  routesFileDir: string,
  projectRoot: string
): string {
  let resolved = path.resolve(routesFileDir, specifier).replace(/\\/g, "/")
  if (!/\.(tsx?|jsx?|mjs|cjs)$/.test(resolved)) {
    for (const ext of [".tsx", ".ts", ".jsx", ".js"]) {
      const candidate = resolved + ext
      if (candidate.includes("/pages/") || candidate.includes("\\pages\\")) {
        resolved = candidate
        break
      }
    }
  }
  const root = projectRoot.replace(/\\/g, "/").replace(/\/+$/, "")
  if (resolved.startsWith(root + "/")) {
    return resolved.slice(root.length + 1)
  }
  const rel = path.relative(root, resolved).replace(/\\/g, "/")
  if (rel && !rel.startsWith("..")) return rel
  return resolved
}

export type RouteModuleBinding = {
  pathname: string
  pageModuleKey: string
  layoutModuleKeys: string[]
}

/** Extract `createRoute` / root `layout` imports from routes source (programmatic trees). */
export function parseRouteModuleBindings(
  routesSource: string,
  routesFilePath: string,
  projectRoot: string
): RouteModuleBinding[] {
  const routesFileDir = path.dirname(routesFilePath)
  const layoutModuleKeys = [
    ...routesSource.matchAll(
      /layout\s*:\s*\(\)\s*=>\s*import\s*\(\s*["']([^"']+)["']/g
    ),
  ].map((m) => normalizeModuleKey(m[1]!, routesFileDir, projectRoot))

  const bindings: RouteModuleBinding[] = []
  const routeRe =
    /createRoute\s*\(\s*["']([^"']+)["'][\s\S]*?component\s*:\s*\(\)\s*=>\s*import\s*\(\s*["']([^"']+)["']/g
  let m: RegExpExecArray | null
  while ((m = routeRe.exec(routesSource)) !== null) {
    bindings.push({
      pathname: m[1]!,
      pageModuleKey: normalizeModuleKey(m[2]!, routesFileDir, projectRoot),
      layoutModuleKeys,
    })
  }
  return bindings
}

function moduleKeysForRoutePath(
  routePath: string,
  bindingsByPath: Map<string, RouteModuleBinding>,
  fallbackLayoutKeys: string[]
): string[] {
  const binding =
    bindingsByPath.get(routePath) ??
    bindingsByPath.get(routePath.replace(/\/$/, "") || "/")
  const keys = new Set<string>()
  if (binding) {
    for (const k of binding.layoutModuleKeys) keys.add(k)
    keys.add(binding.pageModuleKey)
  } else {
    for (const k of fallbackLayoutKeys) keys.add(k)
    const guessed = guessPageModuleKey(routePath)
    if (guessed) keys.add(guessed)
  }
  return [...keys]
}

function guessPageModuleKey(routePath: string): string | undefined {
  if (routePath === "/" || routePath === "") return "src/pages/index.tsx"
  const clean = routePath.replace(/^\//, "").split("/").filter(Boolean)
  if (clean.length === 0) return "src/pages/index.tsx"
  const base = clean.join("/")
  return `src/pages/${base}.tsx`
}

export type HydrationRouteRef = { id: string; path: string }

export function buildHydrationChunksManifest(input: {
  viteManifest: ViteClientManifest
  /** SSG prerender manifest or full `RouteManifest.routes` — only `id` + `path` are used. */
  routes: HydrationRouteRef[]
  routeBindings: RouteModuleBinding[]
}): HydrationChunksManifest {
  const { viteManifest, routes, routeBindings } = input
  const entry = resolveEntryChunkUrl(viteManifest)
  const bootstrap = resolveEntryBootstrapUrls(viteManifest)
  const bootstrapSet = new Set(bootstrap)
  const modules: Record<string, string[]> = {}

  for (const key of Object.keys(viteManifest)) {
    if (!key.includes(".") || key.endsWith(".html")) continue
    if (!key.match(/\.(tsx?|jsx?|mjs|cjs)$/)) continue
    const urls = [...new Set(resolveModuleChunkUrls(viteManifest, key))]
    if (urls.length) modules[key] = urls
  }

  const bindingsByPath = new Map(
    routeBindings.map((b) => [b.pathname, b] as const)
  )
  const fallbackLayoutKeys = routeBindings[0]?.layoutModuleKeys ?? []

  const byRouteId: Record<string, string[]> = {}
  const byPathname: Record<string, string[]> = {}

  for (const route of routes) {
    const moduleKeys = moduleKeysForRoutePath(
      route.path,
      bindingsByPath,
      fallbackLayoutKeys
    )
    const urls = [
      ...new Set(
        moduleKeys.flatMap(
          (k) => modules[k] ?? resolveModuleChunkUrls(viteManifest, k)
        )
      ),
    ].filter((u) => (!entry || u !== entry) && !bootstrapSet.has(u))
    byRouteId[route.id] = urls
    byPathname[route.path] = urls
  }

  return {
    version: 1,
    entry,
    bootstrap,
    modules,
    byRouteId,
    byPathname,
  }
}

export async function readRoutesSource(
  routesModuleAbs: string
): Promise<string> {
  const { promises: fs } = await import("node:fs")
  return fs.readFile(routesModuleAbs, "utf8")
}

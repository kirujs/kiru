import type {
  CompiledRoute,
  GenerateSitemapParams,
  GenerateStaticParams,
  RouteManifest,
} from "./types.js"

export type RouteBuildMetaEntry = {
  generateStaticParams?: GenerateStaticParams
  generateSitemapParams?: GenerateSitemapParams
}

/** Build-time metadata keyed by {@link CompiledRoute.id} (from page module exports). */
export type RouteBuildMeta = {
  byRouteId: Record<string, RouteBuildMetaEntry>
}

export const emptyRouteBuildMeta = (): RouteBuildMeta => ({ byRouteId: {} })

function readNamedExport<T extends (...args: never[]) => unknown>(
  mod: unknown,
  exportName: string
): T | undefined {
  if (!mod || typeof mod !== "object") return undefined
  const fn = (mod as Record<string, unknown>)[exportName]
  return typeof fn === "function" ? (fn as T) : undefined
}

function readGenerateStaticParams(
  mod: unknown
): GenerateStaticParams | undefined {
  return readNamedExport<GenerateStaticParams>(mod, "generateStaticParams")
}

function readGenerateSitemapParams(
  mod: unknown
): GenerateSitemapParams | undefined {
  return readNamedExport<GenerateSitemapParams>(mod, "generateSitemapParams")
}

export type DiscoverRouteBuildMetaOptions = {
  /** Route path templates from `site.sitemap.include` (normalized). */
  includeRoutePaths?: string[]
}

/**
 * SSR-load page modules and collect build-time exports (not on the client manifest).
 */
export async function discoverRouteBuildMeta(
  manifest: RouteManifest,
  loadPageModule: (route: CompiledRoute) => Promise<unknown>,
  opts?: DiscoverRouteBuildMetaOptions
): Promise<RouteBuildMeta> {
  const includeSet = new Set(opts?.includeRoutePaths ?? [])
  const byRouteId: Record<string, RouteBuildMetaEntry> = {}

  for (const route of manifest.routes) {
    const needsStatic = route.static && route.params.length > 0
    const needsSitemap =
      includeSet.has(route.path) && route.params.length > 0 && !route.static
    if (!needsStatic && !needsSitemap) continue

    const mod = await loadPageModule(route)
    const entry: RouteBuildMetaEntry = {}

    if (needsStatic) {
      const generateStaticParams = readGenerateStaticParams(mod)
      if (generateStaticParams) {
        entry.generateStaticParams = generateStaticParams
      }
    }

    if (needsSitemap) {
      const generateSitemapParams = readGenerateSitemapParams(mod)
      if (generateSitemapParams) {
        entry.generateSitemapParams = generateSitemapParams
      }
    }

    if (entry.generateStaticParams || entry.generateSitemapParams) {
      byRouteId[route.id] = entry
    }
  }

  return { byRouteId }
}

export function getRouteGenerateStaticParams(
  route: CompiledRoute,
  meta: RouteBuildMeta | undefined
): GenerateStaticParams | undefined {
  return meta?.byRouteId[route.id]?.generateStaticParams
}

export function getRouteGenerateSitemapParams(
  route: CompiledRoute,
  meta: RouteBuildMeta | undefined
): GenerateSitemapParams | undefined {
  return meta?.byRouteId[route.id]?.generateSitemapParams
}

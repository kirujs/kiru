import type { CompiledRoute, GenerateStaticParams, RouteManifest } from "./types.js"

export type RouteBuildMetaEntry = {
  generateStaticParams?: GenerateStaticParams
}

/** Build-time metadata keyed by {@link CompiledRoute.id} (from page module exports). */
export type RouteBuildMeta = {
  byRouteId: Record<string, RouteBuildMetaEntry>
}

export const emptyRouteBuildMeta = (): RouteBuildMeta => ({ byRouteId: {} })

function readGenerateStaticParams(
  mod: unknown
): GenerateStaticParams | undefined {
  if (!mod || typeof mod !== "object") return undefined
  const fn = (mod as Record<string, unknown>).generateStaticParams
  return typeof fn === "function" ? (fn as GenerateStaticParams) : undefined
}

/**
 * SSR-load each static dynamic route's page module and collect
 * `generateStaticParams` exports (not stored on the client route manifest).
 */
export async function discoverRouteBuildMeta(
  manifest: RouteManifest,
  loadPageModule: (route: CompiledRoute) => Promise<unknown>
): Promise<RouteBuildMeta> {
  const byRouteId: Record<string, RouteBuildMetaEntry> = {}
  for (const route of manifest.routes) {
    if (!route.static || route.params.length === 0) continue
    const mod = await loadPageModule(route)
    const generateStaticParams = readGenerateStaticParams(mod)
    if (generateStaticParams) {
      byRouteId[route.id] = { generateStaticParams }
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

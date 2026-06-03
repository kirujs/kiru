import { matchRoute } from "./manifest.js"
import { pathnameForMatch, resolvePathPolicy } from "./pathPolicy.js"
import {
  getISRRevalidate,
  getISRTags,
  readRouteISRExport,
} from "./routeRevalidate.js"
import type { PrerenderCacheEntry, PrerenderCacheStore } from "./prerenderCache.js"
import type { RouteManifest } from "./types.js"
import type { SsrRenderHit } from "./renderErrorRecovery.js"

export type IsrRegenerateDeps = {
  manifest: RouteManifest
  pathPolicy: ReturnType<typeof resolvePathPolicy>
  renderCore: (
    pathname: string,
    ctx?: { context?: Record<string, unknown> }
  ) => Promise<SsrRenderHit | null>
  getPrerenderCache: () => Promise<PrerenderCacheStore | undefined>
  bypassPrerenderServe: { current: boolean }
}

export function createIsrRegenerateHandler(
  deps: IsrRegenerateDeps
): (storageKey: string, pathname: string) => Promise<void> {
  const { manifest, pathPolicy, renderCore, getPrerenderCache, bypassPrerenderServe } =
    deps
  return async (storageKey: string, pathname: string) => {
    const cache = await getPrerenderCache()
    if (!cache) return
    const prerenderMatch = matchRoute(
      manifest,
      pathnameForMatch(pathname, pathPolicy),
      pathPolicy
    )
    if (!prerenderMatch) return
    bypassPrerenderServe.current = true
    try {
      const regenHit = await renderCore(pathname, undefined)
      const body =
        regenHit?.kind === "string" ? regenHit.result.body : undefined
      if (typeof body !== "string" || !body) return
      const regenMod = await prerenderMatch.route.component()
      const regenIsr = readRouteISRExport(regenMod)
      const entry: PrerenderCacheEntry = {
        html: body,
        pathname,
        generatedAt: Date.now(),
        revalidate: getISRRevalidate(regenIsr) ?? false,
        tags: getISRTags(regenIsr) ?? [],
      }
      await cache.set(storageKey, entry)
    } finally {
      bypassPrerenderServe.current = false
    }
  }
}

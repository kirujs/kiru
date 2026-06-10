import { stripBase } from "./pathPolicy.js"
import { matchRoute } from "./manifest.js"
import { loadRouteTree } from "./routeTree.js"
import type { RouteManifest } from "./types.js"
import { validateSearchForMatch } from "./validateSearchForMatch.js"
import {
  buildLoaderContextForMatch,
  resolvePagePropsFromModule,
} from "./runPageLoad.js"
import { isLoaderRpcAvailable } from "./loaderClient.js"
import { readPageLoadExport } from "./loaders.js"
import type { ClientOutletRouter } from "./clientRoutePrep.js"
import { preloadChunksForMatch } from "./hydrationChunks.js"
import {
  findMatchingInterceptor,
  prefetchInterceptorLoad,
} from "./routeInterceptors.js"
import { tryGetRouterInstanceRuntime } from "./routerRuntime.js"
import {
  buildLoaderCacheKey,
  getLoaderCacheEntry,
  getLoaderRpcInFlight,
} from "./loaderCache.js"
type PrefetchFlight = {
  abort: AbortController
  promise: Promise<void>
}

const prefetchFlightByHref = new Map<string, PrefetchFlight>()

export type PrefetchRouteOptions = {
  manifest: RouteManifest
  href: string
  baseUrl: string
  router: ClientOutletRouter
  chunks?: boolean
  data?: boolean
  /** When false, skip interceptor load prefetch. Default true. */
  intercept?: boolean
  /** Prefetch registered interceptor `load` when navigation would soft-intercept. Default follows `data`. */
  interceptLoad?: boolean
}

function cancelPrefetch(href: string): void {
  prefetchFlightByHref.get(href)?.abort.abort()
  prefetchFlightByHref.delete(href)
}

async function runPrefetchRoute(
  options: PrefetchRouteOptions,
  signal: AbortSignal
): Promise<void> {
  const {
    manifest,
    href,
    baseUrl,
    router,
    chunks = true,
    data: dataOpt,
    intercept: allowIntercept = true,
    interceptLoad: interceptLoadOpt,
  } = options
  const data = dataOpt ?? isLoaderRpcAvailable()
  const interceptLoad = interceptLoadOpt ?? data

  const pathname = stripBase(href, baseUrl)
  const toMatch = matchRoute(manifest, pathname)
  if (!toMatch) return

  const routerWithMatch = router as ClientOutletRouter & {
    match: { peek(): import("./types.js").RouteMatch | null }
  }
  const fromMatch = routerWithMatch.match.peek()
  const runtime = tryGetRouterInstanceRuntime(
    router as import("./routerInstance.js").Router
  )
  const registrations = runtime?.getRouteInterceptorRegistrations?.() ?? []
  const buildTargetLocation = runtime?.buildTargetLocation
  const interceptor =
    allowIntercept &&
    fromMatch &&
    registrations.length > 0 &&
    buildTargetLocation
      ? findMatchingInterceptor(registrations, fromMatch, toMatch)
      : null

  if (interceptor && interceptLoad && buildTargetLocation && !signal.aborted) {
    await prefetchInterceptorLoad(
      interceptor,
      toMatch,
      buildTargetLocation,
      signal,
      () => router.requestContext.peek()
    )
    return
  }

  if (signal.aborted) return
  if (chunks) {
    preloadChunksForMatch(toMatch)
  }

  if (!data) return
  const [searchCheck, tree] = await Promise.all([
    validateSearchForMatch(toMatch, router.query.peek(), {
      hash: router.hash.peek(),
    }),
    loadRouteTree(toMatch),
  ])
  if (!searchCheck.ok || signal.aborted) return

  try {
    if (!tree || signal.aborted) return
    const pageMod = tree.routeModule
    const load = readPageLoadExport(pageMod)
    if (!load) return
    const loaderCtx = buildLoaderContextForMatch(router, toMatch, signal, {
      validatedQuery: searchCheck.validatedQuery,
      params: searchCheck.params,
    })
    const cacheKey = buildLoaderCacheKey(
      toMatch.route.id,
      loaderCtx.url.pathname,
      loaderCtx.url.search
    )
    if (getLoaderCacheEntry(cacheKey)?.data !== undefined) {
      return
    }
    const inFlightLoader = getLoaderRpcInFlight(cacheKey)
    if (inFlightLoader) {
      await inFlightLoader
      return
    }
    await resolvePagePropsFromModule(pageMod, loaderCtx, {
      useHydratedPageData: false,
      routeId: toMatch.route.id,
    })
  } catch {
    if (!signal.aborted) return
  }
}

export async function prefetchRoute(
  options: PrefetchRouteOptions
): Promise<void> {
  const { href } = options
  const inFlight = prefetchFlightByHref.get(href)
  if (inFlight && !inFlight.abort.signal.aborted) {
    return inFlight.promise
  }

  cancelPrefetch(href)
  const abort = new AbortController()
  const promise = runPrefetchRoute(options, abort.signal)
  prefetchFlightByHref.set(href, { abort, promise })
  try {
    await promise
  } finally {
    if (prefetchFlightByHref.get(href)?.abort === abort) {
      prefetchFlightByHref.delete(href)
    }
  }
}

export type LinkPrefetch =
  | false
  | {
      trigger?: "hover" | "visible"
      chunks?: boolean
      data?: boolean
      /** When false, skip route interceptors for prefetch (use target route loader). Default true. */
      intercept?: boolean
      /** Prefetch interceptor `load` on soft-intercept links. Default follows `data`. */
      interceptLoad?: boolean
    }

export function resolveLinkPrefetch(
  prefetch: LinkPrefetch | undefined
): LinkPrefetch | false {
  if (prefetch === false) return false
  const base: Exclude<LinkPrefetch, false> = {
    trigger: "hover",
    chunks: true,
    data: isLoaderRpcAvailable(),
    intercept: true,
    ...prefetch,
  }
  return base
}

export function runLinkPrefetch(
  router: ClientOutletRouter & {
    manifest: RouteManifest
    baseUrl: string
    navigationMode: string
  },
  href: string,
  prefetch: LinkPrefetch | undefined,
  options?: { intercept?: boolean }
): void {
  const resolved = resolveLinkPrefetch(prefetch)
  if (resolved === false || router.navigationMode !== "history") return
  const linkIntercept = options?.intercept ?? resolved.intercept ?? true
  void prefetchRoute({
    manifest: router.manifest,
    href,
    baseUrl: router.baseUrl,
    router,
    chunks: resolved.chunks,
    data: resolved.data,
    intercept: linkIntercept,
    interceptLoad: resolved.interceptLoad,
  })
}

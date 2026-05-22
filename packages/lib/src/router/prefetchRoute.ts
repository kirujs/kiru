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
  } = options
  const data = dataOpt ?? isLoaderRpcAvailable()

  const pathname = stripBase(href, baseUrl)
  const match = matchRoute(manifest, pathname)
  if (!match) return

  if (chunks) {
    if (signal.aborted) return
    preloadChunksForMatch(match)
  }

  if (!data || signal.aborted) return

  const searchCheck = await validateSearchForMatch(match, router.query.peek(), {
    hash: router.hash.peek(),
  })
  if (!searchCheck.ok || signal.aborted) return

  try {
    const tree = await loadRouteTree(match)
    if (!tree || signal.aborted) return
    const pageMod = tree.routeModule
    const load = readPageLoadExport(pageMod)
    if (!load) return
    const loaderCtx = buildLoaderContextForMatch(router, match, signal, {
      validatedQuery: searchCheck.validatedQuery,
      params: searchCheck.params,
    })
    await resolvePagePropsFromModule(pageMod, loaderCtx, {
      useHydratedPageData: false,
      routeId: match.route.id,
    })
  } catch {
    if (!signal.aborted) return
  }
}

export async function prefetchRoute(options: PrefetchRouteOptions): Promise<void> {
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
    }

export function resolveLinkPrefetch(
  prefetch: LinkPrefetch | undefined
): LinkPrefetch | false {
  if (prefetch === false) return false
  const base: Exclude<LinkPrefetch, false> = {
    trigger: "hover",
    chunks: true,
    data: isLoaderRpcAvailable(),
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
  prefetch: LinkPrefetch | undefined
): void {
  const resolved = resolveLinkPrefetch(prefetch)
  if (resolved === false || router.navigationMode !== "history") return
  void prefetchRoute({
    manifest: router.manifest,
    href,
    baseUrl: router.baseUrl,
    router,
    chunks: resolved.chunks,
    data: resolved.data,
  })
}

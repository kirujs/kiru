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
import { isRpcTraceEnabled, rpcTrace } from "../remote/rpcTrace.js"
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
  /** Diagnostics only — hover vs visible link prefetch. */
  trigger?: string
}

function cancelPrefetch(href: string): void {
  prefetchFlightByHref.get(href)?.abort.abort()
  prefetchFlightByHref.delete(href)
}

function findInFlightPrefetch(href: string): PrefetchFlight | undefined {
  const flight = prefetchFlightByHref.get(href)
  if (flight && !flight.abort.signal.aborted) return flight
  return undefined
}

/** Join navigation with an in-flight Link prefetch for the same href (if any). */
export async function awaitInFlightPrefetch(...hrefs: string[]): Promise<void> {
  for (const href of hrefs) {
    if (!href) continue
    const flight = findInFlightPrefetch(href)
    if (!flight) continue
    if (isRpcTraceEnabled()) {
      rpcTrace({
        channel: "prefetch",
        phase: "prefetch_join_nav",
        meta: { href },
      })
    }
    await flight.promise
    return
  }
}

/** Abort any in-flight prefetch for these href keys (e.g. forced loader reload). */
export function cancelInFlightPrefetch(...hrefs: string[]): void {
  for (const href of hrefs) {
    if (!href) continue
    cancelPrefetch(href)
  }
}

/** @internal Tests only */
export function __clearPrefetchFlightsForTests(): void {
  for (const href of [...prefetchFlightByHref.keys()]) {
    cancelPrefetch(href)
  }
}

/** @internal Tests only */
export function __setPrefetchFlightForTests(
  href: string,
  promise: Promise<void>
): AbortController {
  const abort = new AbortController()
  prefetchFlightByHref.set(href, { abort, promise })
  return abort
}

async function runPrefetchRoute(
  options: PrefetchRouteOptions,
  signal: AbortSignal,
  trigger?: string
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

  const pf = (phase: string, meta?: Record<string, string | number | boolean>) => {
    if (!isRpcTraceEnabled()) return
    rpcTrace({ channel: "prefetch", phase, meta: { href, ...meta } })
  }

  pf("prefetch_start", { trigger: trigger ?? "unknown" })

  const pathname = stripBase(href, baseUrl)
  const match = matchRoute(manifest, pathname)
  if (!match) return

  if (chunks) {
    if (signal.aborted) {
      pf("prefetch_aborted", { at: "chunks" })
      return
    }
    pf("prefetch_chunks", {})
    preloadChunksForMatch(match)
  }

  if (!data || signal.aborted) {
    if (signal.aborted) pf("prefetch_aborted", { at: "data" })
    return
  }

  const searchCheck = await validateSearchForMatch(match, router.query.peek(), {
    hash: router.hash.peek(),
  })
  if (!searchCheck.ok || signal.aborted) {
    pf("prefetch_validate_search", { ok: false })
    return
  }

  try {
    pf("prefetch_load_tree", {})
    const tree = await loadRouteTree(match)
    if (!tree || signal.aborted) {
      if (signal.aborted) pf("prefetch_aborted", { at: "tree" })
      return
    }
    const pageMod = tree.routeModule
    const load = readPageLoadExport(pageMod)
    if (!load) return
    pf("prefetch_loader_invoke", { routeId: match.route.id })
    const loaderCtx = buildLoaderContextForMatch(router, match, signal, {
      validatedQuery: searchCheck.validatedQuery,
      params: searchCheck.params,
    })
    await resolvePagePropsFromModule(pageMod, loaderCtx, {
      useHydratedPageData: false,
      routeId: match.route.id,
    })
    pf("prefetch_done", { routeId: match.route.id })
  } catch (err) {
    if (signal.aborted) {
      pf("prefetch_aborted", { at: "invoke" })
      return
    }
    pf("prefetch_error", {
      error: err instanceof Error ? err.message : String(err),
    })
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
  const promise = runPrefetchRoute(options, abort.signal, options.trigger)
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
    trigger: resolved.trigger,
  })
}

import { stripBase } from "./pathPolicy.js"
import { matchRoute } from "./manifest.js"
import { shouldDeferProtectedOutlet } from "./contextGate.js"
import { loadRouteTree } from "./routeTree.js"
import type { RouteManifest } from "./types.js"
import { validateSearchForMatch } from "./validateSearchForMatch.js"
import {
  buildLoaderContextForMatch,
  resolvePagePropsFromModule,
} from "./runPageLoad.js"
import { isLoaderRpcAvailable } from "./loaderClient.js"
import { readPageLoadExport } from "./loaders.js"
import type { Router } from "./csr.js"
import type { ClientOutletRouter } from "./clientRoutePrep.js"
import { getRouterRuntime } from "./routerRuntime.js"
const prefetchAbortByHref = new Map<string, AbortController>()

export type PrefetchRouteOptions = {
  manifest: RouteManifest
  href: string
  baseUrl: string
  router: ClientOutletRouter
  chunks?: boolean
  data?: boolean
}

function cancelPrefetch(href: string): void {
  prefetchAbortByHref.get(href)?.abort()
  prefetchAbortByHref.delete(href)
}

export async function prefetchRoute(options: PrefetchRouteOptions): Promise<void> {
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

  cancelPrefetch(href)
  const abort = new AbortController()
  prefetchAbortByHref.set(href, abort)
  const signal = abort.signal

  const gateOptions = getRouterRuntime(router as Router).gateOptions
  const deferOptions = {
    ...gateOptions,
    manifest,
    isNavigating: router.isNavigating.peek(),
    navigationToPathname: router.currentNavigation.peek()?.to.pathname,
    contextState: router.contextState.peek(),
  }

  if (shouldDeferProtectedOutlet(match, router.contextGate.peek(), deferOptions)) {
    return
  }

  if (chunks) {
    for (const scope of match.route.scopes) {
      if (signal.aborted) return
      void scope.layout?.()
    }
    if (
      shouldDeferProtectedOutlet(match, router.contextGate.peek(), deferOptions)
    ) {
      return
    }
    void match.route.component()
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
  } finally {
    if (prefetchAbortByHref.get(href) === abort) {
      prefetchAbortByHref.delete(href)
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

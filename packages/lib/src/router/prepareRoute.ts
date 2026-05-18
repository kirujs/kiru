import type { LoaderContext, KiruLoader, PageProps } from "./loaders.js"
import {
  canStreamPageLoad,
  readLoaderFallback,
  readPageLoadExport,
} from "./loaders.js"
import { isStaticPageHead, readPageHeadExport } from "./pageHead.js"
import { wrapRouteModuleWithLoadGate } from "./pageLoadGate.js"
import { resolvePagePropsFromModule } from "./runPageLoad.js"
import type { RouteModule } from "./types.js"
import type { LeafRouteProps } from "./routeTree.js"

export type PrepareRouteForNavigationOptions = {
  /** When false, skip `k-page-data` for server loaders (client navigations). */
  useHydratedPageData?: boolean
  /** When true, always refetch loaders (invalidation). */
  forceReload?: boolean
  /** Active route id for client loader cache keys. */
  routeId?: string
  /** Bumps outlet when stale loader cache finishes background refetch. */
  onCacheRefreshed?: () => void
}

export type PreparedRouteNavigation = {
  routeModule: RouteModule
  leafProps: LeafRouteProps
  pageMod: unknown
  loaderCtx: LoaderContext
  usesLoadGate: boolean
  isLoaderStale?: boolean
}

/**
 * Shared client/SSR prep: resolve loader props or wrap with streaming load gate.
 */
export async function prepareRouteForNavigation(input: {
  pageMod: unknown
  routeModule: RouteModule
  loaderCtx: LoaderContext
  options?: PrepareRouteForNavigationOptions
}): Promise<PreparedRouteNavigation> {
  const { pageMod, routeModule, loaderCtx, options } = input
  const useHydrated =
    options?.forceReload === true
      ? false
      : options?.useHydratedPageData ?? true

  const load = readPageLoadExport(pageMod)
  if (!load) {
    return {
      routeModule,
      leafProps: {},
      pageMod,
      loaderCtx,
      usesLoadGate: false,
    }
  }

  const pageHead = readPageHeadExport(pageMod)
  if (canStreamPageLoad(load) && isStaticPageHead(pageHead)) {
    const fallback = readLoaderFallback(load)
    if (fallback) {
      return {
        routeModule: wrapRouteModuleWithLoadGate(
          routeModule,
          load,
          loaderCtx,
          fallback
        ),
        leafProps: {},
        pageMod,
        loaderCtx,
        usesLoadGate: true,
      }
    }
  }

  const resolved = await resolvePagePropsFromModule(pageMod, loaderCtx, {
    useHydratedPageData: useHydrated,
    forceReload: options?.forceReload,
    routeId: options?.routeId,
    onCacheRefreshed: options?.onCacheRefreshed,
  })

  return {
    routeModule,
    leafProps: resolved.props as LeafRouteProps,
    pageMod,
    loaderCtx,
    usesLoadGate: false,
    isLoaderStale: resolved.isStale,
  }
}

export type { PageProps, KiruLoader }

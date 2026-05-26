import type { KiruLoader, PageProps } from "./loaders.js"
import { formatRouterSearch } from "./navigation.js"
import {
  buildScopeCacheKey,
  createNavigationScope,
  isScopeCurrent,
  type NavigationScope,
} from "./navigationScope.js"
import {
  isStaticPageHead,
  isSyncPageHead,
  readPageHeadExport,
  syncDocumentHeadForPage,
} from "./pageHead.js"
import { prepareRouteForNavigation } from "./prepareRoute.js"
import {
  buildLoaderContextForMatch,
  type LoaderContextRouterSlice,
} from "./runPageLoad.js"
import {
  buildRoutedSubtree,
  loadNotFoundRouteTree,
  loadRouteTree,
  renderClientErrorOutlet,
  type LeafRouteProps,
} from "./routeTree.js"
import type { CurrentNavigation } from "./types.js"
import type { RouteMatch, RouteModule } from "./types.js"
import type { Router } from "./routerInstance.js"

export type ClientOutletRouter = LoaderContextRouterSlice &
  Pick<
    Router,
    | "manifest"
    | "pathname"
    | "query"
    | "isNavigating"
    | "currentNavigation"
    | "forceLoaderReload"
    | "loaderEpoch"
    | "isLoaderStale"
  >

/** Unwrapped deps passed to the `RouterView` outlet `resource()` loader. */
export type RouterOutletResourceSnapshot = {
  match: RouteMatch | null
  pathname: string
  loaderEpoch: number
  outletRenderError: Error | null
  isNavigating: boolean
  currentNavigation: CurrentNavigation | null
}

export function asClientOutletRouter(router: Router): ClientOutletRouter {
  return router
}

export type PrepareRouteWithDocumentHeadInput = {
  router: ClientOutletRouter
  match: RouteMatch
  pageMod: unknown
  routeModule: RouteModule
  signal: AbortSignal
  scope: NavigationScope
  getNavGeneration: () => number
  useHydratedPageData?: boolean
  forceReload?: boolean
}

export type PreparedClientRoute = {
  routeModule: RouteModule
  leafProps: LeafRouteProps
  usesLoadGate: boolean
  isLoaderStale?: boolean
  discarded?: boolean
}

export async function prepareRouteWithDocumentHead(
  input: PrepareRouteWithDocumentHeadInput
): Promise<PreparedClientRoute> {
  const {
    router,
    match,
    pageMod,
    routeModule,
    signal,
    scope,
    getNavGeneration,
    useHydratedPageData = true,
    forceReload,
  } = input
  const pageHead = readPageHeadExport(pageMod)
  const headCommit = { scope, getNavGeneration }
  const loaderCtx = buildLoaderContextForMatch(router, match, signal)
  const headCanRunParallel =
    isStaticPageHead(pageHead) || isSyncPageHead(pageHead)
  const preparePromise = prepareRouteForNavigation({
    pageMod,
    routeModule,
    loaderCtx,
    options: {
      useHydratedPageData,
      forceReload: forceReload ?? router.forceLoaderReload.peek(),
      routeId: match.route.id,
      scope,
      getNavGeneration,
      onCacheRefreshed: () => {
        router.loaderEpoch.set((prev) => prev + 1)
      },
    },
  })
  const prepared = headCanRunParallel
    ? (
        await Promise.all([
          preparePromise,
          syncDocumentHeadForPage(
            match,
            loaderCtx,
            undefined,
            pageMod,
            headCommit
          ),
        ])
      )[0]
    : await preparePromise
  if (!prepared.discarded && !prepared.usesLoadGate && !headCanRunParallel) {
    await syncDocumentHeadForPage(
      match,
      loaderCtx,
      prepared.leafProps as PageProps<KiruLoader<unknown>>,
      pageMod,
      headCommit
    )
  }
  return {
    routeModule: prepared.routeModule,
    leafProps: prepared.leafProps,
    usesLoadGate: prepared.usesLoadGate,
    isLoaderStale: prepared.isLoaderStale,
    discarded: prepared.discarded,
  }
}

export type BuildClientOutletSubtreeInput = {
  router: ClientOutletRouter
  match: RouteMatch | null
  pathname: string
  signal: AbortSignal
  getNavGeneration: () => number
  useHydratedPageData?: boolean
  forceReload?: boolean
  /** SSR/SSG client outlet: sync render throws on leaf routes (see bootstrapSsrClient). */
  onLeafRenderError?: (err: unknown) => void
}

export async function buildClientOutletSubtree(
  input: BuildClientOutletSubtreeInput
): Promise<JSX.Element | null> {
  const {
    router,
    match,
    pathname,
    signal,
    getNavGeneration,
    useHydratedPageData = true,
    forceReload,
    onLeafRenderError,
  } = input
  const scope =
    match !== null
      ? createNavigationScope(
          getNavGeneration(),
          signal,
          buildScopeCacheKey(
            match.route.id,
            match.pathname,
            formatRouterSearch(router.query.peek())
          )
        )
      : createNavigationScope(getNavGeneration(), signal)
  try {
    const tree = match
      ? await loadRouteTree(match)
      : await loadNotFoundRouteTree(router.manifest, pathname)
    if (!isScopeCurrent(scope, getNavGeneration) || signal.aborted) return null

    let leafProps: LeafRouteProps = {}
    let routeModule = tree?.routeModule
    if (match && tree) {
      const prepared = await prepareRouteWithDocumentHead({
        router,
        match,
        pageMod: tree.routeModule,
        routeModule: tree.routeModule,
        signal,
        scope,
        getNavGeneration,
        useHydratedPageData,
        forceReload,
      })
      if (
        prepared.discarded ||
        !isScopeCurrent(scope, getNavGeneration) ||
        signal.aborted
      ) {
        return null
      }
      router.forceLoaderReload.set(false)
      router.isLoaderStale.set(prepared.isLoaderStale === true)
      routeModule = prepared.routeModule
      leafProps = prepared.leafProps
    }

    if (!isScopeCurrent(scope, getNavGeneration) || signal.aborted) return null
    return tree && routeModule
      ? buildRoutedSubtree(tree.layoutModules, routeModule, leafProps, {
          onLeafRenderError,
        })
      : null
  } catch (err) {
    if (signal.aborted) return null
    const recovery = await renderClientErrorOutlet(router.manifest, match, err)
    if (recovery) return recovery
    throw err
  }
}

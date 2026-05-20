import type { KiruLoader, PageProps } from "./loaders.js"
import {
  resolvePendingOutletMatch,
  shouldDeferProtectedOutlet,
} from "./contextGate.js"
import {
  effectiveContextPendingFallback,
  type ContextGateOptions,
} from "./routeMeta.js"
import { warnProtectedImportBeforeGate } from "./devWarnings.js"
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
import type { Router } from "./routerInstance.js"
import { getRouterRuntime } from "./routerRuntime.js"
import type { RouteManifest, RouteMatch, RouteModule } from "./types.js"

export type ClientOutletRouter = LoaderContextRouterSlice & {
  manifest: RouteManifest
  pathname: { peek(): string }
  isNavigating: { peek(): boolean }
  currentNavigation: {
    peek(): { to: { pathname: string } } | null
  }
  contextGate: { peek(): import("./types.js").ContextGateState }
  contextState: { peek(): import("./types.js").ContextState }
  contextPendingFallback?: () => JSX.Element
  forceLoaderReload: { peek(): boolean; value: boolean }
  loaderEpoch: { value: number }
  isLoaderStale: { value: boolean }
}

function gateOptionsFor(router: ClientOutletRouter): ContextGateOptions {
  return getRouterRuntime(router as Router).gateOptions
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
        router.loaderEpoch.value += 1
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
  } = input
  const gateOptions = gateOptionsFor(router)
  const nav = router.currentNavigation.peek()
  const deferOptions = {
    ...gateOptions,
    manifest: router.manifest,
    isNavigating: router.isNavigating.peek(),
    navigationToPathname: nav?.to.pathname,
    contextState: router.contextState.peek(),
  }
  const outletMatch = resolvePendingOutletMatch(
    match,
    router.manifest,
    deferOptions.isNavigating,
    deferOptions.navigationToPathname
  )
  if (
    match &&
    shouldDeferProtectedOutlet(match, router.contextGate.peek(), deferOptions)
  ) {
    const pending = effectiveContextPendingFallback(
      outletMatch,
      router.contextPendingFallback
    )
    return pending ? pending() : null
  }
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
      if (
        shouldDeferProtectedOutlet(match, router.contextGate.peek(), deferOptions)
      ) {
        warnProtectedImportBeforeGate(match.route.id)
        const pending = effectiveContextPendingFallback(
          outletMatch,
          router.contextPendingFallback
        )
        return pending ? pending() : null
      }
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
      router.forceLoaderReload.value = false
      router.isLoaderStale.value = prepared.isLoaderStale === true
      routeModule = prepared.routeModule
      leafProps = prepared.leafProps
    }

    if (!isScopeCurrent(scope, getNavGeneration) || signal.aborted) return null
    return tree && routeModule
      ? buildRoutedSubtree(tree.layoutModules, routeModule, leafProps)
      : null
  } catch (err) {
    if (signal.aborted) return null
    const recovery = await renderClientErrorOutlet(
      router.manifest,
      match,
      err
    )
    if (recovery) return recovery
    throw err
  }
}

import { resource } from "../resource.js"
import { createElement } from "../element.js"
import { renderMode } from "../globals.js"
import { onMount } from "../hooks/onMount.js"
import { ErrorBoundary } from "../components/errorBoundary.js"
import { buildClientOutletSubtree, prepareRouteWithDocumentHead } from "./clientRoutePrep.js"
import { loadRouteTree, buildRoutedSubtree, renderClientErrorOutlet } from "./routeTree.js"
import { toRenderError } from "./types.js"
import { useRouter } from "./routerContext.js"
import { getRouterInstanceRuntime } from "./routerRuntime.js"
import type { Router } from "./csr.js"
import type { RouteManifest, RouteMatch, CustomRequestContext } from "./types.js"
import { announceNavigationIfReady } from "./navigationAnnouncer.js"
import {
  canEndClientNavigation,
  tryClearClientNavigation,
} from "./outletNavigation.js"
import {
  buildScopeCacheKey,
  createNavigationScope,
  isScopeCurrent,
  type NavigationScope,
} from "./navigationScope.js"
import { formatRouterSearch } from "./navigation.js"
import { bootstrapStreamedHydration, setBuildingInitialSsrOutlet } from "./pageData.js"
import { logOutletDebug } from "./outletDebug.js"
export type SsrClientOutletProps = {
  manifest: RouteManifest
  /**
   * Pre-built route subtree for static hydration (built under `I18nReactiveRoot` on a
   * scratch mount). Omitted for dynamic SSR — the outlet resource loads on first render.
   */
  initialSubtree?: JSX.Element | null
  /** Server stream render: same ErrorBoundary shell as CSR with a static routed subtree. */
  staticSubtree?: JSX.Element | null
}

type SsrClientRouter = Router

export async function buildSsrClientOutlet(
  committedMatch: RouteMatch | null,
  router: SsrClientRouter,
  manifest: RouteManifest,
  options: { useHydratedPageData: boolean; forceReload: boolean },
  outlet: { value: JSX.Element | null },
  scope?: NavigationScope,
  getNavGeneration?: () => number
): Promise<JSX.Element | null> {
  const runtime = getRouterInstanceRuntime(router)
  const gen = getNavGeneration ?? runtime.getNavGeneration
  const signal = scope?.signal ?? runtime.getNavSignal()
  if (scope && (!isScopeCurrent(scope, gen) || scope.signal.aborted)) {
    return null
  }
  const outletErr = router.outletRenderError.peek()
  if (outletErr) {
    router.isLoaderPending.value = true
    try {
      return await renderClientErrorOutlet(manifest, committedMatch, outletErr)
    } finally {
      if (!signal.aborted) router.isLoaderPending.value = false
    }
  }
  router.isLoaderPending.value = true
  try {
    const intercept = router.interceptState.peek()
    return buildClientOutletSubtree({
      router,
      match: committedMatch,
      pathname: intercept
        ? intercept.backgroundMatch.pathname
        : router.pathname.peek(),
      signal,
      getNavGeneration: gen,
      scope,
      useHydratedPageData: options.useHydratedPageData,
      forceReload: options.forceReload,
      onLeafRenderError: (err) => {
        const renderErr = toRenderError(err)
        const matchAtError = committedMatch
        router.outletRenderError.value = renderErr
        void recoverSsrOutletFromRenderError(
          router,
          manifest,
          outlet,
          matchAtError,
          renderErr
        )
      },
    })
  } finally {
    if (!signal.aborted) router.isLoaderPending.value = false
  }
}

function isSameCommittedMatch(
  current: RouteMatch | null,
  atError: RouteMatch | null
): boolean {
  if (current === atError) return true
  if (!current || !atError) return false
  return (
    current.route.id === atError.route.id &&
    current.pathname === atError.pathname
  )
}

function canCommitSsrOutletUpdate(
  router: SsrClientRouter,
  matchAtRefreshStart: RouteMatch | null,
  options: {
    refreshSignal?: AbortSignal
    expectedOutletError?: Error | null
  } = {}
): boolean {
  if (options.refreshSignal?.aborted) return false
  if (options.expectedOutletError !== undefined) {
    if (router.outletRenderError.peek() !== options.expectedOutletError) {
      return false
    }
  }
  return isSameCommittedMatch(router.match.peek(), matchAtRefreshStart)
}

async function recoverSsrOutletFromRenderError(
  router: SsrClientRouter,
  manifest: RouteManifest,
  outlet: { value: JSX.Element | null },
  matchAtError: RouteMatch | null,
  err: Error
): Promise<void> {
  const recovery = await renderClientErrorOutlet(manifest, matchAtError, err)
  if (
    recovery &&
    canCommitSsrOutletUpdate(router, matchAtError, {
      expectedOutletError: err,
    })
  ) {
    outlet.value = recovery
  }
}

/**
 * SSR/SSG client route outlet: builds the matched subtree under `I18nReactiveRoot` when
 * `i18n` is configured (same invariant as {@link RouterView} on CSR).
 */
export function SsrClientOutlet({
  manifest,
  initialSubtree,
  staticSubtree,
}: SsrClientOutletProps) {
  if (
    staticSubtree !== undefined &&
    (renderMode.current === "stream" || renderMode.current === "string")
  ) {
    return () => staticSubtree
  }

  const router = useRouter()
  const { match, loaderEpoch, outletRenderError } = router
  const { getNavGeneration } = getRouterInstanceRuntime(router)
  const useHydratedPageDataRef = { current: true }
  const outletRef = { value: initialSubtree ?? null }
  const bootstrapOutlet =
    initialSubtree !== undefined ? { current: initialSubtree } : null
  const hydrateMatchRef = { current: router.match.peek() }
  const outletMatchRef = { current: router.match.peek() }
  const deferOutletLoadRef = { current: initialSubtree !== undefined }

  const commitOutletSubtree = (
    subtree: JSX.Element | null,
    committedMatch: RouteMatch | null = router.match.peek()
  ): JSX.Element | null => {
    if (subtree != null) {
      const prevRouteId = outletMatchRef.current?.route.id ?? null
      if (bootstrapOutlet) bootstrapOutlet.current = null
      outletMatchRef.current = committedMatch
      if (
        prevRouteId &&
        committedMatch &&
        prevRouteId !== committedMatch.route.id
      ) {
        logOutletDebug("leaf:swap", {
          fromRouteId: prevRouteId,
          toRouteId: committedMatch.route.id,
        })
      }
    }
    return subtree
  }

  const outletContentMatches = (
    committedMatch: RouteMatch | null
  ): boolean => {
    return (
      committedMatch != null &&
      outletMatchRef.current != null &&
      isSameCommittedMatch(outletMatchRef.current, committedMatch)
    )
  }

  const resourceValueMatchesOutlet = (content: JSX.Element | null): boolean => {
    if (content == null) return false
    if (outletRef.value == null) return true
    return content === outletRef.value
  }

  const staleOutletFallback = (
    committedMatch: RouteMatch | null
  ): JSX.Element | null => {
    if (outletRef.value && outletContentMatches(committedMatch)) {
      return outletRef.value
    }
    return null
  }

  const resolveOutletContent = (): JSX.Element | null => {
    const committedMatch = router.match.peek()
    let content = children.value

    if (
      content != null &&
      (!outletContentMatches(committedMatch) ||
        !resourceValueMatchesOutlet(content))
    ) {
      content = null
    }

    if (content != null) return content

    if (
      bootstrapOutlet?.current &&
      isSameCommittedMatch(hydrateMatchRef.current, committedMatch)
    ) {
      return bootstrapOutlet.current
    }

    if (
      children.isPending.peek() &&
      outletRef.value &&
      outletContentMatches(committedMatch)
    ) {
      return outletRef.value
    }

    return staleOutletFallback(committedMatch)
  }

  const children = resource({
    source: {
      match,
      loaderEpoch,
      outletRenderError,
    },
    load: loadOutlet,
  })

  async function loadOutlet(
    _source: {
      match: RouteMatch | null
      outletRenderError: Error | null
    },
    { signal }: { signal: AbortSignal }
  ): Promise<JSX.Element | null> {
    if (deferOutletLoadRef.current) {
      logOutletDebug("load:defer-bootstrap", {
        hasBootstrap: bootstrapOutlet?.current != null,
        routeId: router.match.peek()?.route.id,
      })
      return bootstrapOutlet?.current ?? outletRef.value ?? null
    }
    const committedMatch = router.match.peek()
    logOutletDebug("load:start", {
      routeId: committedMatch?.route.id ?? null,
      routePath: committedMatch?.route.path ?? null,
      pathname: committedMatch?.pathname ?? null,
      signalAborted: signal.aborted,
      useHydrated: useHydratedPageDataRef.current,
      navGen: getNavGeneration(),
      outletMatchRouteId: outletMatchRef.current?.route.id ?? null,
      hydrateMatchRouteId: hydrateMatchRef.current?.route.id ?? null,
      hasBootstrap: bootstrapOutlet?.current != null,
      loaderEpoch: loaderEpoch.peek(),
    })
    if (
      bootstrapOutlet?.current &&
      !isSameCommittedMatch(hydrateMatchRef.current, committedMatch)
    ) {
      bootstrapOutlet.current = null
    }
    const err = router.outletRenderError.peek()
    if (err) {
      router.isLoaderPending.value = true
      try {
        return commitOutletSubtree(
          await renderClientErrorOutlet(router.manifest, committedMatch, err),
          committedMatch
        )
      } finally {
        if (!signal.aborted) router.isLoaderPending.value = false
      }
    }
    const scope =
      committedMatch !== null
        ? createNavigationScope(
            getNavGeneration(),
            signal,
            buildScopeCacheKey(
              committedMatch.route.id,
              committedMatch.pathname,
              formatRouterSearch(router.query.peek())
            )
          )
        : createNavigationScope(getNavGeneration(), signal)
    const useHydrated = useHydratedPageDataRef.current
    const subtree = await buildSsrClientOutlet(
      committedMatch,
      router,
      manifest,
      {
        useHydratedPageData: useHydrated,
        forceReload: router.forceLoaderReload.peek(),
      },
      outletRef,
      scope,
      getNavGeneration
    )
    router.forceLoaderReload.value = false
    const matchStillCommitted = isSameCommittedMatch(
      committedMatch,
      router.match.peek()
    )
    const scopeCurrent = isScopeCurrent(scope, getNavGeneration)
    logOutletDebug("load:built", {
      routeId: committedMatch?.route.id ?? null,
      hasSubtree: subtree != null,
      scopeCurrent,
      scopeGen: scope.generation,
      navGen: getNavGeneration(),
      signalAborted: signal.aborted,
      matchStillCommitted,
      routerMatchRouteId: router.match.peek()?.route.id ?? null,
    })
    if (!scopeCurrent || signal.aborted) {
      if (subtree != null && matchStillCommitted) {
        logOutletDebug("load:commit", { via: "scope-stale-subtree" })
        outletRef.value = subtree
        return commitOutletSubtree(subtree, committedMatch)
      }
      if (signal.aborted) {
        logOutletDebug("load:discarded", {
          reason: "aborted",
          routeId: committedMatch?.route.id ?? null,
        })
        return null
      }
      logOutletDebug("load:commit", {
        via: "scope-stale-fallback",
        fallbackRouteId: outletMatchRef.current?.route.id ?? null,
      })
      return staleOutletFallback(committedMatch)
    }
    const pendingErr = router.outletRenderError.peek()
    if (pendingErr) {
      const errOut = await renderClientErrorOutlet(
        manifest,
        router.match.peek(),
        pendingErr
      )
      if (
        errOut &&
        canCommitSsrOutletUpdate(router, committedMatch, {
          refreshSignal: signal,
          expectedOutletError: pendingErr,
        })
      ) {
        outletRef.value = errOut
        return commitOutletSubtree(errOut, committedMatch)
      }
      return staleOutletFallback(committedMatch)
    }
    if (subtree != null) {
      outletRef.value = subtree
    }
    logOutletDebug("load:commit", {
      via: subtree != null ? "subtree" : "null-subtree",
      routeId: committedMatch?.route.id ?? null,
    })
    return commitOutletSubtree(subtree ?? null, committedMatch)
  }

  onMount(() => {
    if (initialSubtree !== undefined) {
      deferOutletLoadRef.current = false
      queueMicrotask(() => {
        bootstrapStreamedHydration({ seedKData: true })
        useHydratedPageDataRef.current = false
      })
    }
    const unsubOutletErr = router.outletRenderError.subscribe((err) => {
      if (err) {
        if (bootstrapOutlet) bootstrapOutlet.current = null
        children.refetch()
      }
    })
    const unsubMatch = match.subscribe((nextMatch, prevMatch) => {
      if (
        bootstrapOutlet?.current &&
        !isSameCommittedMatch(hydrateMatchRef.current, nextMatch)
      ) {
        bootstrapOutlet.current = null
      }
      const routeChanged =
        prevMatch?.route.id !== nextMatch?.route.id ||
        prevMatch?.pathname !== nextMatch?.pathname
      if (routeChanged) {
        hydrateMatchRef.current = nextMatch
        const paramOnlyNav =
          prevMatch?.route.id === nextMatch?.route.id &&
          prevMatch?.pathname !== nextMatch?.pathname
        if (paramOnlyNav && nextMatch) {
          logOutletDebug("layout:persist", {
            routeId: nextMatch.route.id,
            fromPathname: prevMatch?.pathname ?? null,
            toPathname: nextMatch.pathname,
          })
        }
      }
    })
    const unsubIntercept = router.interceptState.subscribe(() => {
      if (
        router.isNavigating.peek() &&
        canEndClientNavigation(router)
      ) {
        tryClearClientNavigation(router)
      }
    })
    const onPendingChange = (pending: boolean) => {
      if (
        !pending &&
        router.isNavigating.peek() &&
        canEndClientNavigation(router)
      ) {
        tryClearClientNavigation(router)
        queueMicrotask(() => announceNavigationIfReady(router))
      }
    }
    const unsubPending = children.isPending.subscribe(onPendingChange)
    onPendingChange(children.isPending.peek())
    return () => {
      unsubOutletErr()
      unsubMatch()
      unsubIntercept()
      unsubPending()
    }
  })

  return () => {
    const content = resolveOutletContent()
    return createElement(ErrorBoundary, {
      fallback: (error: Error) => {
        outletRenderError.value = error
        return null
      },
      children: content,
    })
  }
}

export async function buildInitialSsrOutletInShell(
  router: SsrClientRouter,
  _manifest: RouteManifest,
  _requestContext: CustomRequestContext
): Promise<JSX.Element | null> {
  const committedMatch = router.match.peek()
  if (!committedMatch) return null
  setBuildingInitialSsrOutlet(true)
  try {
    const { getNavGeneration } = getRouterInstanceRuntime(router)
    const abort = new AbortController()
    const scope = createNavigationScope(
      getNavGeneration(),
      abort.signal,
      buildScopeCacheKey(
        committedMatch.route.id,
        committedMatch.pathname,
        formatRouterSearch(router.query.peek())
      )
    )
    const tree = await loadRouteTree(committedMatch)
    const prepared = await prepareRouteWithDocumentHead({
      router,
      match: committedMatch,
      pageMod: tree.routeModule,
      routeModule: tree.routeModule,
      signal: abort.signal,
      scope,
      getNavGeneration,
      useHydratedPageData: true,
      forceReload: false,
    })
    if (prepared.discarded) return null
    return buildRoutedSubtree(
      tree.layoutModules,
      prepared.routeModule,
      prepared.leafProps,
      { match: committedMatch }
    )
  } finally {
    setBuildingInitialSsrOutlet(false)
  }
}

import { resource } from "../resource.js"
import { createElement } from "../element.js"
import { signal } from "../signals/base.js"
import { onMount } from "../hooks/onMount.js"
import { mount } from "../appHandle.js"
import { ErrorBoundary } from "../components/errorBoundary.js"
import { buildClientOutletSubtree } from "./clientRoutePrep.js"
import { renderClientErrorOutlet } from "./routeTree.js"
import { toRenderError } from "./types.js"
import { I18nReactiveRoot } from "./i18nContext.js"
import { RequestContextProvider } from "./requestContext.js"
import { RouterProvider } from "./csr.js"
import { getRouterInstanceRuntime } from "./routerRuntime.js"
import { useRouter } from "./routerContext.js"
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

export type SsrClientOutletProps = {
  manifest: RouteManifest
  /**
   * Pre-built route subtree for static hydration (built under `I18nReactiveRoot` on a
   * scratch mount). Omitted for dynamic SSR — the outlet resource loads on first render.
   */
  initialSubtree?: JSX.Element | null
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
    return buildClientOutletSubtree({
      router,
      match: committedMatch,
      pathname: router.pathname.peek(),
      signal,
      getNavGeneration: gen,
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
export function SsrClientOutlet({ manifest, initialSubtree }: SsrClientOutletProps) {
  const router = useRouter()
  const { match, pathname, loaderEpoch, outletRenderError } = router
  const { getNavGeneration } = getRouterInstanceRuntime(router)
  const useHydratedPageDataRef = { current: true }
  const outletRef = { value: initialSubtree ?? null }
  const bootstrapOutlet =
    initialSubtree !== undefined ? { current: initialSubtree } : null

  const commitOutletSubtree = (subtree: JSX.Element | null): JSX.Element | null => {
    if (subtree != null && bootstrapOutlet) bootstrapOutlet.current = null
    return subtree
  }

  const children = resource({
    source: {
      match,
      pathname,
      loaderEpoch,
      outletRenderError,
      isNavigating: router.isNavigating,
      currentNavigation: router.currentNavigation,
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
    const committedMatch = router.match.peek()
    const err = router.outletRenderError.peek()
    if (err) {
      router.isLoaderPending.value = true
      try {
        return commitOutletSubtree(
          await renderClientErrorOutlet(router.manifest, committedMatch, err)
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
    useHydratedPageDataRef.current = false
    if (!isScopeCurrent(scope, getNavGeneration) || signal.aborted) {
      return outletRef.value
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
        return commitOutletSubtree(errOut)
      }
      return outletRef.value
    }
    if (subtree != null) {
      outletRef.value = subtree
    }
    return commitOutletSubtree(subtree ?? null)
  }

  onMount(() => {
    const unsubOutletErr = router.outletRenderError.subscribe((err) => {
      if (err) {
        if (bootstrapOutlet) bootstrapOutlet.current = null
        children.refetch()
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
      unsubPending()
    }
  })

  return () => {
    const content = children.value ?? bootstrapOutlet?.current ?? null
    return createElement(ErrorBoundary, {
      fallback: (error: Error) => {
        outletRenderError.value = error
        return null
      },
      children: content,
    })
  }
}

/**
 * Build the initial outlet subtree under the full SSR shell (including `I18nReactiveRoot`)
 * so route setup hooks like `useI18n()` run with providers. Used before static hydration
 * when the prerendered DOM must match the first client VDOM.
 */
export async function buildInitialSsrOutletInShell(
  router: SsrClientRouter,
  manifest: RouteManifest,
  requestContext: CustomRequestContext
): Promise<JSX.Element | null> {
  const committedMatch = router.match.peek()
  if (!committedMatch) return null
  const outlet = signal<JSX.Element | null>(null)
  const scratch = document.createElement("div")
  let buildPromise: Promise<void> | undefined

  function BootstrapOutlet() {
    return () => {
      buildPromise ??= buildSsrClientOutlet(
        committedMatch,
        router,
        manifest,
        { useHydratedPageData: true, forceReload: false },
        outlet
      ).then((subtree) => {
        if (subtree != null) outlet.value = subtree
      })
      return outlet.value
    }
  }

  const i18nRuntime = getRouterInstanceRuntime(router).i18n?.runtime
  const shell = createElement(RequestContextProvider, {
    value: requestContext,
    children: i18nRuntime
      ? createElement(I18nReactiveRoot, {
          runtime: i18nRuntime,
          children: createElement(RouterProvider, {
            router,
            children: createElement(BootstrapOutlet),
          }),
        })
      : createElement(RouterProvider, {
          router,
          children: createElement(BootstrapOutlet),
        }),
  })

  const app = mount(shell, scratch)

  if (!buildPromise) {
    app.unmount()
    throw new Error("SsrClientOutlet bootstrap mount did not queue outlet build")
  }
  await buildPromise
  app.unmount()

  return outlet.value
}

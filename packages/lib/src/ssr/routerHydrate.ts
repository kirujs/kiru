import type { AppHandle, AppHandleOptions } from "../appHandle.js"
import { Fragment } from "../element.js"
import { signal } from "../signals/index.js"
import { hydrate } from "./client.js"
import { buildClientOutletSubtree } from "../router/clientRoutePrep.js"
import { createRouter } from "../router/csr.js"
import { renderClientErrorOutlet } from "../router/routeTree.js"
import { createSsrRouterShell } from "../router/routerShell.js"
import { toRenderError } from "../router/types.js"
import { registerKiruRouter } from "../router/routerGlobal.js"
import { compileRouteTree } from "../router/manifest.js"
import type {
  RouteManifest,
  RouteMatch,
  RouteTreeDefinition,
} from "../router/types.js"
import { ensureClientI18nReady } from "../router/i18nContext.js"
import { readHydratedRequestContext } from "../router/requestContext.js"
import {
  buildScopeCacheKey,
  createNavigationScope,
  isScopeCurrent,
  type NavigationScope,
} from "../router/navigationScope.js"
import { formatRouterSearch } from "../router/navigation.js"
import { tryClearClientNavigation } from "../router/outletNavigation.js"
import { requestToken } from "../globals.js"
import { applyActionResponseHeaders } from "../router/routerGlobal.js"
import {
  isKiruRedirect,
  serializeActionCallQuery,
  type RemoteActionCallOptions,
} from "../remote/action.js"
import { buildActionRpcHeaders } from "../remote/actionRequestHeaders.js"
import { ActionDispatchError } from "../remote/errors.js"
import { __DEV__, __KIRU_PURE_CLIENT__ } from "../env.js"
import { REMOTE_ACTION_PURE_CLIENT_DEV_MSG } from "../router/devWarnings.dev.js"
import { ensureLoaderClient } from "../router/loaderClient.js"
import { loadClientHydrationChunksManifest } from "../router/hydrationChunks.js"
import { getRouterRuntime } from "../router/routerRuntime.js"

type ServerActionsClient = {
  dispatch: (
    id: string,
    call?: RemoteActionCallOptions<unknown, Record<string, unknown>>
  ) => Promise<unknown>
}

function ensureServerActionsClient() {
  if (typeof window === "undefined") return
  const g = globalThis as typeof globalThis & {
    __kiru_serverActions?: ServerActionsClient
  }

  if (g.__kiru_serverActions) return

  g.__kiru_serverActions = {
    dispatch: async (id, call) => {
      if (__DEV__ && __KIRU_PURE_CLIENT__) {
        throw new ActionDispatchError(500, REMOTE_ACTION_PURE_CLIENT_DEV_MSG)
      }
      const callEnvelope = call ?? {}
      const headers = buildActionRpcHeaders(
        requestToken.current,
        callEnvelope.headers
      )
      const init: RequestInit = {
        method: "POST",
        signal: callEnvelope.signal,
        headers,
        body: JSON.stringify(
          callEnvelope.body === undefined ? null : callEnvelope.body
        ),
      }
      const queryString =
        callEnvelope.query && Object.keys(callEnvelope.query).length > 0
          ? serializeActionCallQuery(callEnvelope.query)
          : ""
      const actionUrl = queryString
        ? `/?action=${encodeURIComponent(id)}&${queryString}`
        : `/?action=${encodeURIComponent(id)}`
      const r = await fetch(actionUrl, init)
      applyActionResponseHeaders(r.headers)

      if (!r.ok) {
        throw new ActionDispatchError(r.status || 500, "Action failed")
      }

      const text = await r.text()
      if (!text) return undefined

      let data: unknown
      try {
        data = JSON.parse(text) as unknown
      } catch {
        throw new ActionDispatchError(500, "Invalid action response")
      }

      if (isKiruRedirect(data)) {
        window.location.assign(
          new URL((data as { location: string }).location, window.location.href)
            .href
        )
        return undefined
      }

      return data
    },
  }
}

export function __kiruEnsureRemoteDispatch(): ServerActionsClient["dispatch"] {
  ensureServerActionsClient()
  return (
    globalThis as typeof globalThis & {
      __kiru_serverActions?: ServerActionsClient
    }
  ).__kiru_serverActions!.dispatch
}

export {
  __kiruEnsureLoaderDispatch,
  ensureLoaderClient,
  getLoaderDispatch,
  isLoaderRpcAvailable,
} from "../router/loaderClient.js"

/**
 * Lower-level hydrate entry for SSR and SSG documents (`kiru/ssr/router`).
 * Prefer {@link createRouterApp} from `kiru/router/ssr` or `kiru/router/ssg` unless you
 * need direct control over {@link bootstrapSsrClient} / {@link bootstrapSsgClient}.
 *
 * @see docs/router/route-middleware-and-context.md
 */
export type BootstrapSsrClientOptions = {
  /** Route tree from {@link createRouteTree} or a precompiled {@link RouteManifest}. */
  routes: RouteTreeDefinition | RouteManifest
  /** DOM element that receives the hydrated router outlet. */
  container: HTMLElement
  /**
   * Options for {@link mount}. `hydrationMode`: `"static"` (SSG) or `"dynamic"` (SSR).
   * `kiru/router/ssr` sets `"dynamic"`; `kiru/router/ssg` sets `"static"`.
   */
  hydrateOptions?: AppHandleOptions & {
    hydrationMode?: "static" | "dynamic"
  }
  /**
   * Client i18n bundles; should match {@link createRenderer} / prerender locale config.
   */
  i18n?: import("../router/i18n/index.js").InternationalizationConfig<
    readonly string[],
    unknown
  >
}

/**
 * Fragments are not sent on HTTP requests, so SSR HTML matches `hash: ""`.
 * Clear the client router hash until after hydration to avoid text-node mismatches.
 */
function stashClientHashForSsrHydration(
  router: ReturnType<typeof createRouter>
): string {
  if (typeof window === "undefined") return ""
  const hash = window.location.hash
  if (hash) router.hash.value = ""
  return hash
}

function restoreClientHashAfterHydration(
  router: ReturnType<typeof createRouter>,
  hash: string
): void {
  if (hash) router.hash.value = hash
}

type SsrClientRouter = ReturnType<typeof createRouter>

async function buildSsrClientOutlet(
  committedMatch: RouteMatch | null,
  router: SsrClientRouter,
  manifest: RouteManifest,
  options: { useHydratedPageData: boolean; forceReload: boolean },
  outlet: { value: JSX.Element | null },
  scope?: NavigationScope,
  getNavGeneration?: () => number
): Promise<JSX.Element | null> {
  const runtime = getRouterRuntime(router)
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

/** Guards stale async outlet updates after refresh / error recovery. */
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

function subscribeSsrClientOutlet(
  router: SsrClientRouter,
  manifest: RouteManifest,
  outlet: { value: JSX.Element | null },
  buildOptions: { useHydratedPageData: boolean }
): void {
  let outletAbort: AbortController | null = null
  const getNavGeneration = getRouterRuntime(router).getNavGeneration
  async function refreshOutlet(forceReload: boolean) {
    outletAbort?.abort()
    const ctrl = new AbortController()
    outletAbort = ctrl
    const match = router.match.peek()
    const outletErr = router.outletRenderError.peek()
    if (outletErr) {
      router.isLoaderPending.value = true
      try {
        const recovery = await renderClientErrorOutlet(
          manifest,
          match,
          outletErr
        )
        if (
          recovery &&
          canCommitSsrOutletUpdate(router, match, {
            refreshSignal: ctrl.signal,
            expectedOutletError: outletErr,
          })
        ) {
          outlet.value = recovery
        }
      } finally {
        if (!ctrl.signal.aborted) router.isLoaderPending.value = false
      }
      tryClearClientNavigation(router)
      return
    }
    const scope =
      match !== null
        ? createNavigationScope(
            getNavGeneration(),
            ctrl.signal,
            buildScopeCacheKey(
              match.route.id,
              match.pathname,
              formatRouterSearch(router.query.peek())
            )
          )
        : createNavigationScope(getNavGeneration(), ctrl.signal)
    try {
      const subtree = await buildSsrClientOutlet(
        match,
        router,
        manifest,
        { ...buildOptions, forceReload },
        outlet,
        scope,
        getNavGeneration
      )
      if (ctrl.signal.aborted || !isScopeCurrent(scope, getNavGeneration)) {
        return
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
          canCommitSsrOutletUpdate(router, match, {
            refreshSignal: ctrl.signal,
            expectedOutletError: pendingErr,
          })
        ) {
          outlet.value = errOut
        }
      } else {
        outlet.value = subtree
      }
      tryClearClientNavigation(router)
    } catch {
      if (!ctrl.signal.aborted) throw new Error("SSR outlet refresh failed")
    }
  }
  const refresh = (forceReload: boolean) => {
    void refreshOutlet(forceReload)
  }
  router.match.subscribe(() => refresh(false))
  router.isNavigating.subscribe(() => refresh(false))
  router.currentNavigation.subscribe(() => refresh(false))
  router.outletRenderError.subscribe(() => refresh(false))
}

/**
 * Hydrate an SSR document from {@link createRenderer} / {@link fillRouteHtmlTemplate}.
 * Preloads the current route (same subtree as the server) and updates the tree on navigations.
 */
export async function bootstrapSsrClient(
  options: BootstrapSsrClientOptions
): Promise<AppHandle> {
  const manifest =
    "routes" in options.routes
      ? options.routes
      : compileRouteTree(options.routes)
  const { container, hydrateOptions, i18n } = options
  const router = createRouter({
    routes: manifest,
    i18n,
  })
  registerKiruRouter(router)
  ensureLoaderClient()
  await loadClientHydrationChunksManifest()
  await ensureClientI18nReady(router)
  const pendingClientHash = stashClientHashForSsrHydration(router)

  const staticHydrate = {
    hydrationMode: "dynamic" as const,
    ...hydrateOptions,
  }

  const requestContext = readHydratedRequestContext()
  const match = router.match.peek()

  const outlet = signal<JSX.Element | null>(null)
  if (match) {
    outlet.value = await buildSsrClientOutlet(
      match,
      router,
      manifest,
      { useHydratedPageData: true, forceReload: false },
      outlet
    )
  }

  const app = hydrate(
    Fragment({
      children: createSsrRouterShell(
        router,
        requestContext,
        () => outlet.value,
        undefined,
        getRouterRuntime(router).i18n?.runtime
      ),
    }),
    container,
    staticHydrate
  )

  subscribeSsrClientOutlet(router, manifest, outlet, {
    useHydratedPageData: false,
  })

  let invalidateAbort: AbortController | null = null
  const getNavGeneration = getRouterRuntime(router).getNavGeneration
  async function refreshOutletOnInvalidate() {
    invalidateAbort?.abort()
    const ctrl = new AbortController()
    invalidateAbort = ctrl
    const current = router.match.peek()
    if (!current) return
    const scope = createNavigationScope(
      getNavGeneration(),
      ctrl.signal,
      buildScopeCacheKey(
        current.route.id,
        current.pathname,
        formatRouterSearch(router.query.peek())
      )
    )
    const subtree = await buildSsrClientOutlet(
      current,
      router,
      manifest,
      {
        useHydratedPageData: false,
        forceReload: router.forceLoaderReload.peek(),
      },
      outlet,
      scope,
      getNavGeneration
    )
    router.forceLoaderReload.value = false
    if (ctrl.signal.aborted || !isScopeCurrent(scope, getNavGeneration)) return
    outlet.value = subtree
    tryClearClientNavigation(router)
  }
  router.loaderEpoch.subscribe(() => {
    void refreshOutletOnInvalidate()
  })

  restoreClientHashAfterHydration(router, pendingClientHash)

  if (typeof window !== "undefined") {
    ;(
      window as typeof window & { __kiruHydratedAt?: number }
    ).__kiruHydratedAt = performance.now()
  }

  return app
}

/**
 * Bootstrap an SSG document (static hydration) while preserving router navigation.
 */
export function bootstrapSsgClient(
  options: Omit<BootstrapSsrClientOptions, "hydrateOptions"> & {
    hydrateOptions?: AppHandleOptions
  }
): Promise<AppHandle> {
  return bootstrapSsrClient({
    ...options,
    hydrateOptions: {
      ...options.hydrateOptions,
      hydrationMode: "static",
    },
  })
}

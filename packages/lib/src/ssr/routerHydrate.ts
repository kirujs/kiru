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
import type { CreateRouterOptions } from "../router/csr.js"
import { ensureClientI18nReady } from "../router/i18nContext.js"
import { readHydratedRequestContext } from "../router/requestContext.js"
import {
  buildScopeCacheKey,
  createNavigationScope,
  isScopeCurrent,
  type NavigationScope,
} from "../router/navigationScope.js"
import { formatRouterSearch } from "../router/navigation.js"
import { requestToken } from "../globals.js"
import {
  markRouterBootstrap,
  type RouterBootstrapMode,
} from "../router/devWarnings.js"
import { applyInvalidateResponseHeader } from "../router/routerGlobal.js"
import { guardRemoteActionOnClient } from "../router/devWarnings.js"

type ServerActionsClient = {
  dispatch: (
    id: string,
    method: "GET" | "POST",
    input: unknown,
    opts?: { signal?: AbortSignal }
  ) => Promise<unknown>
}

function ensureServerActionsClient() {
  if (typeof window === "undefined") return
  const g = globalThis as typeof globalThis & {
    __kiru_serverActions?: ServerActionsClient
  }

  if (g.__kiru_serverActions) return

  g.__kiru_serverActions = {
    dispatch: async (id, method, input, opts) => {
      guardRemoteActionOnClient()
      const headers: Record<string, string> = {
        "x-kiru-token": requestToken.current,
      }
      const init: RequestInit = {
        method,
        signal: opts?.signal,
        headers,
      }
      if (method === "POST") {
        headers["Content-Type"] = "application/json"
        init.body = JSON.stringify(input === undefined ? null : input)
      }
      const r = await fetch(`/?action=${id}`, init)
      if (!r.ok) {
        throw new Error("Action failed")
      }
      applyInvalidateResponseHeader(r.headers.get("x-kiru-invalidate"))
      return r.json()
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

import {
  ensureLoaderClient,
} from "../router/loaderClient.js"
import { getRouterRuntime } from "../router/routerRuntime.js"

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
   * Loads {@link CustomRequestContext} after hydration and on client navigations.
   * Hydrated HTML may already include context via `k-request-context` / render `context`.
   */
  resolveContext?: CreateRouterOptions["resolveContext"]
  /** App default when scope `contextStrategy` is `inherit`. @default "off" */
  contextGate?: CreateRouterOptions["contextGate"]
  /** Outlet UI while a blocked route waits for context. */
  contextPendingFallback?: CreateRouterOptions["contextPendingFallback"]
  /** @default true */
  stickyContext?: CreateRouterOptions["stickyContext"]
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
  /** @internal Set by `kiru/router/ssg` vs `kiru/router/ssr` bootstrap. */
  bootstrapMode?: RouterBootstrapMode
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
  if (
    scope &&
    (!isScopeCurrent(scope, gen) || scope.signal.aborted)
  ) {
    return null
  }
  return buildClientOutletSubtree({
    router,
    match: committedMatch,
    pathname: router.pathname.peek(),
    signal,
    getNavGeneration: gen,
    useHydratedPageData: options.useHydratedPageData,
    forceReload: options.forceReload,
    onLeafRenderError: (err) => {
      router.outletRenderError.value = toRenderError(err)
      void recoverSsrOutletFromRenderError(router, manifest, outlet)
    },
  })
}

async function recoverSsrOutletFromRenderError(
  router: SsrClientRouter,
  manifest: RouteManifest,
  outlet: { value: JSX.Element | null }
): Promise<void> {
  const err = router.outletRenderError.peek()
  if (!err) return
  const recovery = await renderClientErrorOutlet(
    manifest,
    router.match.peek(),
    err
  )
  if (recovery) outlet.value = recovery
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
      if (
        ctrl.signal.aborted ||
        !isScopeCurrent(scope, getNavGeneration)
      ) {
        return
      }
      outlet.value = subtree
    } catch {
      if (!ctrl.signal.aborted) throw new Error("SSR outlet refresh failed")
    }
  }
  const refresh = (forceReload: boolean) => {
    void refreshOutlet(forceReload)
  }
  router.match.subscribe(() => refresh(false))
  router.isNavigating.subscribe(() => refresh(false))
  router.contextState.subscribe(() => refresh(false))
  router.contextGate.subscribe(() => refresh(false))
  router.currentNavigation.subscribe(() => refresh(false))
}

/**
 * Hydrate an SSR document from {@link createRenderer} / {@link fillRouteHtmlTemplate}.
 * Preloads the current route (same subtree as the server) and updates the tree on navigations.
 */
export async function bootstrapSsrClient(
  options: BootstrapSsrClientOptions
): Promise<AppHandle> {
  markRouterBootstrap(options.bootstrapMode ?? "ssr")
  const manifest =
    "routes" in options.routes
      ? options.routes
      : compileRouteTree(options.routes)
  const {
    container,
    hydrateOptions,
    i18n,
    resolveContext,
    contextGate,
    contextPendingFallback,
    stickyContext,
  } = options
  const router = createRouter({
    routes: manifest,
    i18n,
    resolveContext,
    contextGate,
    contextPendingFallback,
    stickyContext,
  })
  registerKiruRouter(router)
  ensureLoaderClient()
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
    bootstrapMode: "ssg",
    hydrateOptions: {
      ...options.hydrateOptions,
      hydrationMode: "static",
    },
  })
}

import type { AppHandle, AppHandleOptions } from "../appHandle.js"
import { Fragment } from "../element.js"
import { signal } from "../signals/index.js"
import { hydrate } from "./client.js"
import {
  resolvePendingOutletMatch,
  shouldDeferProtectedOutlet,
} from "../router/contextGate.js"
import { createRouter } from "../router/csr.js"
import { effectiveContextPendingFallback } from "../router/routeMeta.js"
import { createSsrRouterShell } from "../router/routerShell.js"
import { registerKiruRouter } from "../router/routerGlobal.js"
import { compileRouteTree } from "../router/manifest.js"
import {
  buildRoutedSubtree,
  loadNotFoundRouteTree,
  loadRouteTree,
  type LeafRouteProps,
} from "../router/routeTree.js"
import type {
  RouteManifest,
  RouteMatch,
  RouteTreeDefinition,
} from "../router/types.js"
import type { CreateRouterOptions } from "../router/csr.js"
import { ensureClientI18nReady } from "../router/i18nContext.js"
import { readHydratedRequestContext } from "../router/requestContext.js"
import { loaderI18nFields } from "../router/i18n/index.js"
import { buildLoaderContext } from "../router/runPageLoad.js"
import { prepareRouteForNavigation } from "../router/prepareRoute.js"
import type { RouteModule } from "../router/types.js"
import { requestToken } from "../globals.js"
import { syncDocumentHeadForPage } from "../router/pageHead.js"
import type { PageProps } from "../router/loaders.js"
import type { KiruLoader } from "../router/loaders.js"
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

type LoaderDispatch = (
  routeId: string,
  ctx: import("../router/loaders.js").LoaderContext
) => Promise<unknown>

function ensureLoaderClient() {
  if (typeof window === "undefined") return
  const g = globalThis as typeof globalThis & {
    __kiru_loaders?: { dispatch: LoaderDispatch }
  }
  if (g.__kiru_loaders) return
  g.__kiru_loaders = {
    dispatch: async (routeId, ctx) => {
      const r = await fetch(
        `/?loader=${encodeURIComponent(`${routeId}:load`)}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-kiru-token": requestToken.current,
          },
          body: JSON.stringify(ctx),
        }
      )
      if (!r.ok) throw new Error("Loader request failed")
      return r.json()
    },
  }
}

export function __kiruEnsureLoaderDispatch(): LoaderDispatch {
  ensureLoaderClient()
  return (
    globalThis as typeof globalThis & {
      __kiru_loaders?: { dispatch: LoaderDispatch }
    }
  ).__kiru_loaders!.dispatch
}

/**
 * Lower-level hydrate entry for SSR and SSG documents (`kiru/ssr/router`).
 * Prefer {@link createRouterApp} from `kiru/router/ssr` or `kiru/router/ssg` unless you
 * need direct control over {@link bootstrapSsrClient} / {@link bootstrapSsgClient}.
 *
 * @see docs/router/route-middleware-and-context.md
 */
export type BootstrapSsrClientOptions = {
  /** Route tree from {@link defineRouteTree} or a precompiled {@link RouteManifest}. */
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
  /** Global route middleware (client navigations after first paint). */
  routeMiddleware?: CreateRouterOptions["routeMiddleware"]
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

function loaderContextForMatch(
  routeMatch: { params: Record<string, string> },
  pathname: string,
  router: ReturnType<typeof createRouter>
) {
  return buildLoaderContext({
    params: routeMatch.params,
    pathname,
    search: typeof window !== "undefined" ? window.location.search : "",
    hash: router.hash.peek(),
    query: router.query.peek(),
    context: router.requestContext?.peek() ?? readHydratedRequestContext(),
    meta: {},
    routeId: "route:hydrate",
    ...(router.__i18n && router.locale
      ? loaderI18nFields(router.__i18n.config, router.locale.peek())
      : {}),
  })
}

async function prepareClientRouteForMatch(
  routeMatch: {
    route: { component: () => Promise<unknown> }
    params: Record<string, string>
  },
  pathname: string,
  router: ReturnType<typeof createRouter>,
  routeModule: RouteModule,
  options?: {
    useHydratedPageData?: boolean
    forceReload?: boolean
  }
): Promise<{ routeModule: RouteModule; leafProps: LeafRouteProps }> {
  const pageMod = await routeMatch.route.component()
  const loaderCtx = loaderContextForMatch(routeMatch, pathname, router)
  const prepared = await prepareRouteForNavigation({
    pageMod,
    routeModule,
    loaderCtx,
    options,
  })
  return {
    routeModule: prepared.routeModule,
    leafProps: prepared.leafProps,
  }
}

type SsrClientRouter = ReturnType<typeof createRouter>

async function buildSsrClientOutlet(
  committedMatch: RouteMatch | null,
  router: SsrClientRouter,
  manifest: RouteManifest,
  options: { useHydratedPageData: boolean; forceReload: boolean }
): Promise<JSX.Element | null> {
  if (!committedMatch) {
    const tree = await loadNotFoundRouteTree(manifest, router.pathname.peek())
    return tree
      ? buildRoutedSubtree(tree.layoutModules, tree.routeModule, {})
      : null
  }
  const gateOptions = router.__gateOptions ?? {
    contextGate: "off" as const,
    hasResolveContext: false,
  }
  const nav = router.currentNavigation.peek()
  const deferOptions = {
    ...gateOptions,
    manifest,
    isNavigating: router.isNavigating.peek(),
    navigationToPathname: nav?.to.pathname,
    contextState: router.contextState.peek(),
  }
  const outletMatch =
    resolvePendingOutletMatch(
      committedMatch,
      manifest,
      deferOptions.isNavigating,
      deferOptions.navigationToPathname
    ) ?? committedMatch
  if (
    shouldDeferProtectedOutlet(
      committedMatch,
      router.contextGate.peek(),
      deferOptions
    )
  ) {
    const pending = effectiveContextPendingFallback(
      outletMatch,
      router.contextPendingFallback
    )
    return pending ? pending() : null
  }
  return buildSsrClientSubtree(outletMatch, router, options)
}

function subscribeSsrClientOutlet(
  router: SsrClientRouter,
  manifest: RouteManifest,
  outlet: { value: JSX.Element | null },
  buildOptions: { useHydratedPageData: boolean }
): void {
  let epoch = 0
  const refresh = (forceReload: boolean) => {
    const e = ++epoch
    void (async () => {
      const subtree = await buildSsrClientOutlet(
        router.match.peek(),
        router,
        manifest,
        { ...buildOptions, forceReload }
      )
      if (e !== epoch) return
      outlet.value = subtree
    })()
  }
  router.match.subscribe(() => refresh(false))
  router.isNavigating.subscribe(() => refresh(false))
  router.contextState.subscribe(() => refresh(false))
  router.contextGate.subscribe(() => refresh(false))
  router.currentNavigation.subscribe(() => refresh(false))
}

async function buildSsrClientSubtree(
  match: NonNullable<ReturnType<SsrClientRouter["match"]["peek"]>>,
  router: SsrClientRouter,
  options: { useHydratedPageData: boolean; forceReload: boolean }
): Promise<JSX.Element | null> {
  const pathname = router.pathname.peek()
  const tree = await loadRouteTree(match)
  if (!tree) return null

  const prepared = await prepareClientRouteForMatch(
    match,
    pathname,
    router,
    tree.routeModule,
    options
  )
  await syncDocumentHeadForPage(
    match,
    loaderContextForMatch(match, pathname, router),
    prepared.leafProps as PageProps<KiruLoader<unknown>>
  )

  return buildRoutedSubtree(
    tree.layoutModules,
    prepared.routeModule,
    prepared.leafProps
  )
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
    routeMiddleware,
  } = options
  const router = createRouter({
    routes: manifest,
    i18n,
    resolveContext,
    contextGate,
    contextPendingFallback,
    stickyContext,
    routeMiddleware,
  })
  registerKiruRouter(router)
  await ensureClientI18nReady(router)
  const pendingClientHash = stashClientHashForSsrHydration(router)

  const staticHydrate = {
    hydrationMode: "dynamic" as const,
    ...hydrateOptions,
  }

  const requestContext = readHydratedRequestContext()
  const match = router.match.peek()

  const outlet = signal<JSX.Element | null>(
    match
      ? await buildSsrClientOutlet(match, router, manifest, {
          useHydratedPageData: true,
          forceReload: false,
        })
      : null
  )

  const app = hydrate(
    Fragment({
      children: createSsrRouterShell(
        router,
        requestContext,
        () => outlet.value,
        undefined,
        router.__i18n?.runtime
      ),
    }),
    container,
    staticHydrate
  )

  subscribeSsrClientOutlet(router, manifest, outlet, {
    useHydratedPageData: false,
  })

  let invalidateEpoch = 0
  router.loaderEpoch.subscribe(() => {
    const e = ++invalidateEpoch
    void (async () => {
      const current = router.match.peek()
      if (!current) return
      const subtree = await buildSsrClientOutlet(current, router, manifest, {
        useHydratedPageData: false,
        forceReload: router.forceLoaderReload.peek(),
      })
      router.forceLoaderReload.value = false
      if (e !== invalidateEpoch) return
      outlet.value = subtree
    })()
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

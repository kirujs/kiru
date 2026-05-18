import type { AppHandle, AppHandleOptions } from "../appHandle.js"
import { hydrate } from "./client.js"
import { RouterProvider, createRouter } from "../router/csr.js"
import { compileRouteTree } from "../router/manifest.js"
import {
  buildRoutedSubtree,
  loadNotFoundRouteTree,
  loadRouteTree,
  type LeafRouteProps,
} from "../router/routeTree.js"
import type { RouteManifest, RouteTreeDefinition } from "../router/types.js"
import {
  readHydratedRequestContext,
  RequestContextProvider,
} from "../router/requestContext.js"
import {
  buildLoaderContext,
  resolvePagePropsFromModule,
} from "../router/runPageLoad.js"
import {
  canStreamPageLoad,
  readLoaderFallback,
  readPageLoadExport,
} from "../router/loaders.js"
import { wrapRouteModuleWithLoadGate } from "../router/pageLoadGate.js"
import { isStaticPageHead, readPageHeadExport } from "../router/pageHead.js"
import type { RouteModule } from "../router/types.js"
import { signal } from "../signals/index.js"
import { createElement } from "../element.js"
import { requestToken } from "../globals.js"
import { syncDocumentHeadForPage } from "../router/pageHead.js"
import type { PageProps } from "../router/loaders.js"
import type { KiruLoader } from "../router/loaders.js"
import {
  markRouterBootstrap,
  type RouterBootstrapMode,
} from "../router/devWarnings.js"

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

export interface BootstrapSsrClientOptions {
  routes: RouteTreeDefinition | RouteManifest
  container: HTMLElement
  hydrateOptions?: AppHandleOptions & {
    hydrationMode?: "static" | "dynamic"
  }
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
    context: readHydratedRequestContext(),
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
  options?: { useHydratedPageData?: boolean }
): Promise<{ routeModule: RouteModule; leafProps: LeafRouteProps }> {
  const pageMod = await routeMatch.route.component()
  const load = readPageLoadExport(pageMod)
  if (!load) return { routeModule, leafProps: {} }

  const loaderCtx = loaderContextForMatch(routeMatch, pathname, router)
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
      }
    }
  }

  const leafProps = await resolvePagePropsFromModule(pageMod, loaderCtx, {
    useHydratedPageData: options?.useHydratedPageData ?? true,
  })
  return { routeModule, leafProps: leafProps as LeafRouteProps }
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
  const router = createRouter({ routes: manifest })
  const pendingClientHash = stashClientHashForSsrHydration(router)

  const { container, hydrateOptions } = options
  const staticHydrate = {
    hydrationMode: "dynamic" as const,
    ...hydrateOptions,
  }

  const requestContext = readHydratedRequestContext()
  const pathname = router.pathname.peek()
  const match = router.match.peek()
  const first = match
    ? await loadRouteTree(match)
    : await loadNotFoundRouteTree(manifest, pathname)

  const children = signal<JSX.Element | null>(null)
  if (first && match) {
    const { routeModule, leafProps } = await prepareClientRouteForMatch(
      match,
      pathname,
      router,
      first.routeModule,
      { useHydratedPageData: true }
    )
    if (typeof document !== "undefined") {
      await syncDocumentHeadForPage(
        match,
        loaderContextForMatch(match, pathname, router),
        leafProps as PageProps<KiruLoader<unknown>>
      )
    }
    children.value = buildRoutedSubtree(
      first.layoutModules,
      routeModule,
      leafProps
    )
  }
  let epoch = 0
  router.match.subscribe((match) => {
    const e = ++epoch
    void (async () => {
      const tree = match
        ? await loadRouteTree(match)
        : await loadNotFoundRouteTree(manifest, router.pathname.peek())

      if (e !== epoch) return
      if (!tree) {
        children.value = null
        return
      }
      let routeModule = tree.routeModule
      let leafProps: LeafRouteProps = {}
      if (match) {
        const prepared = await prepareClientRouteForMatch(
          match,
          router.pathname.peek(),
          router,
          tree.routeModule,
          { useHydratedPageData: false }
        )
        if (e !== epoch) return
        routeModule = prepared.routeModule
        leafProps = prepared.leafProps
        await syncDocumentHeadForPage(
          match,
          loaderContextForMatch(match, router.pathname.peek(), router),
          leafProps as PageProps<KiruLoader<unknown>>
        )
        if (e !== epoch) return
      }
      
      if (e !== epoch) return
      children.value = buildRoutedSubtree(
        tree.layoutModules,
        routeModule,
        leafProps
      )
    })()
  })

  const app = hydrate(
    createElement(
      RequestContextProvider,
      { value: requestContext },
      createElement(RouterProvider, {
        router,
        children: () => children.value,
      })
    ),
    container,
    staticHydrate
  )

  restoreClientHashAfterHydration(router, pendingClientHash)

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

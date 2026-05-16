import type { AppHandle, AppHandleOptions } from "../appHandle.js"
import { hydrate } from "./client.js"
import { RouterProvider, createRouter } from "../router/csr.js"
import { compileRouteTree } from "../router/manifest.js"
import {
  buildRoutedSubtree,
  loadNotFoundRouteTree,
  loadRouteTree,
} from "../router/routeTree.js"
import type { RouteManifest, RouteTreeDefinition } from "../router/types.js"
import {
  readHydratedRequestContext,
  RequestContextProvider,
} from "../router/requestContext.js"
import { readHydratedPageData } from "../router/pageData.js"
import {
  buildLoaderContext,
  buildPageProps,
  resolvePagePropsFromModule,
} from "../router/runPageLoad.js"
import { readPageLoadExport } from "../router/loaders.js"
import { signal } from "../signals/index.js"
import { createElement } from "../element.js"
import { requestToken } from "../globals.js"

type ServerActionsClient = {
  dispatch: (
    id: string,
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
    dispatch: async (id, input, opts) => {
      const payload = input === undefined ? null : input
      const r = await fetch(`/?action=${id}`, {
        method: "POST",
        signal: opts?.signal,
        headers: {
          "Content-Type": "application/json",
          "x-kiru-token": requestToken.current,
        },
        body: JSON.stringify(payload),
      })
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
}

async function resolveLeafPropsForMatch(
  routeMatch: { route: { component: () => Promise<unknown> }; params: Record<string, string> },
  pathname: string,
  router: ReturnType<typeof createRouter>
) {
  const pageMod = await routeMatch.route.component()
  if (!readPageLoadExport(pageMod)) return {}
  const hydrated = readHydratedPageData()
  if (hydrated !== undefined) {
    return buildPageProps(hydrated)
  }
  return resolvePagePropsFromModule(
    pageMod,
    buildLoaderContext({
      params: router.params.peek(),
      pathname,
      search: typeof window !== "undefined" ? window.location.search : "",
      hash: router.hash.peek(),
      query: router.query.peek(),
      context: readHydratedRequestContext(),
    })
  )
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
  const router = createRouter({ routes: manifest })

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
    children.value = buildRoutedSubtree(
      first.layoutModules,
      first.routeModule,
      await resolveLeafPropsForMatch(match, pathname, router)
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
      const leafProps = match
        ? await resolveLeafPropsForMatch(
            match,
            router.pathname.peek(),
            router
          )
        : {}
      children.value = buildRoutedSubtree(
        tree.layoutModules,
        tree.routeModule,
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

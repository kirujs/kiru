import type { AppHandle, AppHandleOptions } from "../appHandle.js"
import { hydrate } from "./client.js"
import { RouterProvider, createRouter } from "../router/csr.js"
import { compileRouteTree } from "../router/manifest.js"
import {
  buildRoutedSubtree,
  loadNotFoundRouteTree,
  loadRouteTree,
} from "../router/renderer.js"
import type { RouteManifest, RouteTreeDefinition } from "../router/types.js"
import {
  readHydratedRequestContext,
  RequestContextProvider,
} from "../router/requestContext.js"
import { signal } from "../signals/index.js"
import { createElement } from "../element.js"

export interface BootstrapSsrClientOptions {
  routes: RouteTreeDefinition | RouteManifest
  container: HTMLElement
  hydrateOptions?: AppHandleOptions & {
    hydrationMode?: "static" | "dynamic"
  }
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
  const match = router.match.peek()
  const first = match
    ? await loadRouteTree(match)
    : await loadNotFoundRouteTree(manifest, router.pathname.peek())

  const children = signal(
    first ? buildRoutedSubtree(first.layoutModules, first.routeModule) : null
  )
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
      children.value = buildRoutedSubtree(tree.layoutModules, tree.routeModule)
    })()
  })

  const app = hydrate(
    createElement(
      RequestContextProvider,
      { value: requestContext },
      createElement(RouterProvider, { router, children: () => children.value })
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

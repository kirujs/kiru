import * as kiru from "../index.js"
import type { AppHandle, AppHandleOptions } from "../appHandle.js"
import { hydrate } from "./client.js"
import { RouterProvider, createRouter } from "../router/csr.js"
import { compileRouteTree, matchRoute } from "../router/manifest.js"
import { buildRoutedSubtree, loadRouteTree } from "../router/renderer.js"
import type { RouteManifest, RouteTreeDefinition } from "../router/types.js"

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
  const pathname = window.location.pathname
  const match = matchRoute(manifest, pathname)

  const { container, hydrateOptions } = options
  const staticHydrate = {
    hydrationMode: "dynamic" as const,
    ...hydrateOptions,
  }

  if (!match) {
    return hydrate(<div>Not found</div>, container, staticHydrate)
  }

  const first = await loadRouteTree(match)
  const subtree = buildRoutedSubtree(
    match,
    first.layoutModules,
    first.routeModule
  )

  const app = hydrate(
    <RouterProvider router={router}>{subtree}</RouterProvider>,
    container,
    staticHydrate
  )

  router.path.subscribe(() => {
    void (async () => {
      const m = router.match.peek()
      if (!m) {
        app.render(
          <RouterProvider router={router}>
            <div>Not found</div>
          </RouterProvider>
        )
        return
      }
      const t = await loadRouteTree(m)
      const next = buildRoutedSubtree(m, t.layoutModules, t.routeModule)
      app.render(<RouterProvider router={router}>{next}</RouterProvider>)
    })()
  })

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
      ...(options.hydrateOptions ?? {}),
      hydrationMode: "static",
    },
  })
}

import type { AppHandle, AppHandleOptions } from "../../appHandle.js"
import type { InternationalizationConfig } from "../i18n/index.js"
import { bootstrapSsrClient } from "../../ssr/routerHydrate.js"
import type { CreateRouterAppBaseOptions } from "./types.js"

export type { CreateRouterAppBaseOptions }

/**
 * Options for {@link createRouterApp} from `kiru/router/ssr` (SSR document hydrate).
 * Uses {@link bootstrapSsrClient} after {@link createRenderer} / {@link fillRouteHtmlTemplate}.
 */
export type CreateRouterAppOptions = CreateRouterAppBaseOptions & {
  /** Passed to {@link mount} / hydrate (`hydrationMode` defaults to `"dynamic"` for SSR). */
  hydrateOptions?: AppHandleOptions
  /**
   * Client i18n bundles; should match {@link createRenderer} `i18n` and page modules.
   * Loads the active locale before hydrate when no `k-i18n` payload is in the HTML.
   */
  i18n?: InternationalizationConfig<readonly string[], unknown>
}

/**
 * Hydrate an SSR document from {@link createRenderer} / {@link fillRouteHtmlTemplate}.
 *
 * Import from `kiru/router/ssr` so the bundle excludes CSR-only and SSG-only paths.
 * Lower-level API: `bootstrapSsrClient` from `kiru/ssr/router`.
 */
export function createRouterApp(
  options: CreateRouterAppOptions
): Promise<AppHandle> {
  return bootstrapSsrClient({
    routes: options.routes,
    container: options.container,
    i18n: options.i18n,
    resolveContext: options.resolveContext,
    contextGate: options.contextGate,
    contextPendingFallback: options.contextPendingFallback,
    stickyContext: options.stickyContext,
    routeMiddleware: options.routeMiddleware,
    hydrateOptions: {
      ...options.hydrateOptions,
      hydrationMode: "dynamic",
    },
  })
}

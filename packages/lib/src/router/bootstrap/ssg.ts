import type { AppHandle, AppHandleOptions } from "../../appHandle.js"
import type { InternationalizationConfig } from "../i18n/index.js"
import { bootstrapSsgClient } from "../../ssr/routerHydrate.js"
import type { CreateRouterAppBaseOptions } from "./types.js"

export type { CreateRouterAppBaseOptions }

/**
 * Options for {@link createRouterApp} from `kiru/router/ssg` (static prerender + hydrate).
 * Uses {@link bootstrapSsgClient} with static hydration and client navigations after paint.
 */
export type CreateRouterAppOptions = CreateRouterAppBaseOptions & {
  /** Passed to {@link mount} / hydrate (defaults to static hydration for SSG). */
  hydrateOptions?: AppHandleOptions
  /**
   * Client i18n bundles; should match the locale config used at prerender time.
   * Loads the active locale before hydrate when no `k-i18n` payload is in the HTML.
   */
  i18n?: InternationalizationConfig<readonly string[], unknown>
}

/**
 * Hydrate a static prerender document and preserve client navigations.
 *
 * Import from `kiru/router/ssg` so the bundle excludes CSR-only and SSR-only paths.
 * Lower-level API: `bootstrapSsgClient` from `kiru/ssr/router`.
 */
export function createRouterApp(
  options: CreateRouterAppOptions
): Promise<AppHandle> {
  return bootstrapSsgClient({
    routes: options.routes,
    container: options.container,
    i18n: options.i18n,
    resolveContext: options.resolveContext,
    contextGate: options.contextGate,
    contextPendingFallback: options.contextPendingFallback,
    stickyContext: options.stickyContext,
    hydrateOptions: options.hydrateOptions,
  })
}

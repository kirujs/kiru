import type { AppHandle, AppHandleOptions } from "../../appHandle.js"
import { bootstrapSsgClient } from "../../ssr/routerHydrate.js"
import type { CreateRouterAppBaseOptions } from "./types.js"

export type { CreateRouterAppBaseOptions }

export type CreateRouterAppOptions = CreateRouterAppBaseOptions & {
  hydrateOptions?: AppHandleOptions
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
    hydrateOptions: options.hydrateOptions,
  })
}

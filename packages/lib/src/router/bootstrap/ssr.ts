import type { AppHandle, AppHandleOptions } from "../../appHandle.js"
import { bootstrapSsrClient } from "../../ssr/routerHydrate.js"
import type { CreateRouterAppBaseOptions } from "./types.js"

export type { CreateRouterAppBaseOptions }

export type CreateRouterAppOptions = CreateRouterAppBaseOptions & {
  hydrateOptions?: AppHandleOptions
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
    hydrateOptions: {
      ...options.hydrateOptions,
      hydrationMode: "dynamic",
    },
  })
}

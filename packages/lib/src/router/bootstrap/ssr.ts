import type { AppHandle, AppHandleOptions } from "../../appHandle.js"
import type { InternationalizationConfig } from "../i18n/index.js"
import { bootstrapSsrClient } from "../../ssr/routerHydrate.js"
import type { CreateRouterAppBaseOptions } from "./types.js"

export type { CreateRouterAppBaseOptions }

export type CreateRouterAppOptions = CreateRouterAppBaseOptions & {
  hydrateOptions?: AppHandleOptions
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
    hydrateOptions: {
      ...options.hydrateOptions,
      hydrationMode: "dynamic",
    },
  })
}

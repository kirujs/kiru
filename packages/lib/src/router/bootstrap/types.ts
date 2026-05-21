import type { CreateRouterOptions } from "../csr.js"

/**
 * Shared options for {@link createRouterApp} from `kiru/router/csr`, `kiru/router/ssg`,
 * and `kiru/router/ssr`. Register app-wide middleware on the route tree root scope.
 * Mode-specific wrappers add hydration, i18n, or CSR-only flags.
 */
export type CreateRouterAppBaseOptions = {
  /** Route tree from {@link createRouteTree} or a precompiled {@link RouteManifest}. */
  routes: CreateRouterOptions["routes"]
  /** DOM element that receives the mounted or hydrated router outlet. */
  container: HTMLElement
}

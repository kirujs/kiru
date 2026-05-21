import type { CreateRouterOptions } from "../csr.js"

/**
 * Shared options for {@link createRouterApp} from `kiru/router/csr`, `kiru/router/ssg`,
 * and `kiru/router/ssr`. Same context and middleware fields as {@link CreateRouterOptions},
 * plus a DOM mount target. Register app-wide middleware on the route tree root scope.
 * Mode-specific wrappers add hydration, i18n, or CSR-only flags.
 *
 * @see docs/router/route-middleware-and-context.md
 */
export type CreateRouterAppBaseOptions = {
  /** Route tree from {@link createRouteTree} or a precompiled {@link RouteManifest}. */
  routes: CreateRouterOptions["routes"]
  /** DOM element that receives the mounted or hydrated router outlet. */
  container: HTMLElement
  /**
   * Loads {@link CustomRequestContext} on the client (session, tenant, etc.).
   * Required for `contextStrategy: "block"` scopes.
   */
  resolveContext?: CreateRouterOptions["resolveContext"]
  /**
   * App default when scope `contextStrategy` is `inherit`.
   * @default "off"
   */
  contextGate?: CreateRouterOptions["contextGate"]
  /**
   * Outlet UI while a blocked route waits for context (app default; scopes may override).
   */
  contextPendingFallback?: CreateRouterOptions["contextPendingFallback"]
  /**
   * Reuse the last resolved context on navigations that do not await context.
   * @default true
   */
  stickyContext?: CreateRouterOptions["stickyContext"]
}

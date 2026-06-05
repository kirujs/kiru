import type { defineInterceptors } from "./defineInterceptors.js"
import type { KiruLoader } from "./loaders.js"
import type { KiruPageHead } from "./pageHead.js"
import type { KiruISRConfig } from "./isr.js"

/** Who owns a co-exported `interceptors` module (layout scope or leaf route). */
export type InterceptorOwner =
  | { kind: "scope"; scopeId: string }
  | { kind: "route"; routeId: string }

/** Props passed to SSR `error` route modules after a thrown render failure. */
export interface ErrorPageProps {
  error: Error
}

export type ErrorPage = Kiru.Component<ErrorPageProps>

/**
 * Bare component or `{ default, interceptors? }` shared by layout, page, error,
 * and not-found modules.
 */
export type RoutableModule<T extends Kiru.Component<any>> =
  | T
  | {
      default: T
      interceptors?: ReturnType<typeof defineInterceptors>
    }

/**
 * Layout module (`layout.tsx`). Runtime reads `default` and optional `interceptors` only.
 * Page-only co-exports (`load`, `isr`, …) belong on {@link PageModuleObject}, not layouts.
 */
export type LayoutModule = RoutableModule<Kiru.Component<any>>

/**
 * Not-found module (`not-found.tsx`). Same surface as {@link LayoutModule}.
 * @see LayoutModule
 */
export type NotFoundModule = LayoutModule

/**
 * Error boundary module (`error.tsx`). Receives {@link ErrorPageProps} on the leaf.
 * Supports `default` and optional `interceptors` only.
 */
export type ErrorModule = RoutableModule<ErrorPage>

/** Coerce any thrown value into `Error` for {@link ErrorPageProps}. */
export function toRenderError(thrown: unknown): Error {
  if (thrown instanceof RouteMiddlewareHttpError) return thrown
  if (thrown instanceof Error) return thrown
  return new Error(String(thrown))
}

/** Thrown into the client error outlet when route middleware returns `{ error: status }`. */
export class RouteMiddlewareHttpError extends Error {
  readonly status: number
  readonly body?: string

  constructor(status: number, body?: string) {
    super(body ?? `HTTP ${status}`)
    this.name = "RouteMiddlewareHttpError"
    this.status = status
    this.body = body
  }
}

/**
 * Per-request context for loaders, actions, and components.
 *
 * Defaults to `{}` on pure CSR/SSG. SSR injects per-request values via the
 * adapter/renderer and hydrates them into `RequestContextProvider`.
 *
 * ```ts
 * declare module "kiru/router" {
 *   interface CustomRequestContext {
 *     user: { name: string } | null
 *   }
 * }
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface CustomRequestContext {}

/**
 * Augment with app-specific route metadata (auth policy, roles, etc.).
 *
 * Merged shallowly along the scope chain to the leaf. Use in
 * {@link RouteMiddleware}, not ad hoc closure state.
 *
 * ```ts
 * declare module "kiru/router" {
 *   interface RouteMeta {
 *     requiresAuth?: boolean
 *     unauthorizedRedirect?: string
 *   }
 * }
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface RouteMeta {}

/**
 * `meta` on a scope or route in the route tree.
 *
 * - **Object:** replaces inherited meta (no shallow merge).
 * - **Function:** `(inherited) => meta` — `inherited` is resolved from ancestor scopes.
 */
export type RouteMetaInput =
  | Partial<RouteMeta>
  | ((inherited: RouteMeta) => RouteMeta)

/**
 * `head` on a scope or route in the route tree.
 *
 * - **Object:** replaces inherited head (no `mergeRouteHead`).
 * - **Function:** `(inherited) => head` — `inherited` is resolved from ancestor scopes.
 */
export type RouteHeadMetaInput =
  | RouteHeadMeta
  | ((inherited: RouteHeadMeta) => RouteHeadMeta)

/**
 * Extends the middleware chain from ancestor scopes.
 *
 * Named separately from {@link RouteMiddleware} so TypeScript can infer `inherited`
 * (both are single-argument functions; a bare union would not contextualize).
 */
export type RouteMiddlewareLayer = (
  inherited: RouteMiddleware[]
) => RouteMiddleware[]

/**
 * `middleware` on a scope or route in the route tree.
 *
 * - **Array** (or a single {@link RouteMiddleware}): replaces inherited chain.
 * - **{@link RouteMiddlewareLayer}:** `(inherited) => middleware[]`.
 */
export type RouteMiddlewareInput =
  | RouteMiddleware
  | RouteMiddleware[]
  | RouteMiddlewareLayer

/** Target for middleware or guard redirects. */
export type RouteMiddlewareRedirect =
  | string
  | { path: string; replace?: boolean }

/**
 * Return value from {@link RouteMiddleware}.
 *
 * - `void` — continue the navigation
 * - `{ redirect }` — abort and navigate (CSR history or SSR 3xx)
 * - `{ error, body? }` — HTML error response on SSR
 * - `{ abort: true }` — silent cancel on CSR
 */
export type RouteMiddlewareResult =
  | void
  | { redirect: RouteMiddlewareRedirect }
  | { error: number; body?: string }
  | { abort: true }

/** One segment in `useMatches()` — a scope or leaf on the matched branch. */
export type RouteTreeMatchSegment = {
  id: string
  kind: "scope" | "route"
  meta: RouteMeta
}

/** Destination or source location passed to route middleware. */
export type RouteMiddlewareLocation = {
  pathname: string
  params: Record<string, string>
  query: Record<string, string[]>
  hash: string
  href: string
  routeId: string
  /** Resolved {@link RouteMeta} for this location’s matched leaf. */
  meta: RouteMeta
  segments: RouteTreeMatchSegment[]
}

/** Arguments to {@link RouteMiddleware}; runs before loaders for that navigation. */
export type RouteMiddlewareContext = {
  to: RouteMiddlewareLocation
  from: RouteMiddlewareLocation | null
  /** Present on SSR first paint; usually undefined on CSR client navigations. */
  request?: Request
  context: CustomRequestContext
}

export type RouteMiddleware = (
  ctx: RouteMiddlewareContext
) => RouteMiddlewareResult | Promise<RouteMiddlewareResult>

/**
 * Augment for type-safe `useI18n()`:
 *
 * ```ts
 * declare module "kiru/router" {
 *   interface Internationalization {
 *     config: typeof i18n
 *   }
 * }
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface Internationalization {}

/** Input to {@link GenerateStaticParams} and {@link GenerateSitemapParams}. */
export interface GenerateStaticParamsContext {
  params: Record<string, string>
}

/**
 * Build-time path list for dynamic **static** segments.
 *
 * Export from the **page module** (not `routes.ts` or `page.config.ts`).
 */
export type GenerateStaticParams = (
  ctx: GenerateStaticParamsContext
) => Promise<Array<Record<string, string>>> | Array<Record<string, string>>

/**
 * Build-time path list for routes listed in `site.config` `sitemap.include`.
 *
 * Same shape as {@link GenerateStaticParams}; export from the page module.
 */
export type GenerateSitemapParams = (
  ctx: GenerateSitemapParamsContext
) => Promise<Array<Record<string, string>>> | Array<Record<string, string>>

export type GenerateSitemapParamsContext = GenerateStaticParamsContext

/**
 * Object form of a leaf page module (`pages/*.tsx` / `page.tsx`).
 *
 * Bare `export default` is equivalent to `{ default }` only. Page-only co-exports
 * are ignored on layout, error, and not-found modules — use {@link LayoutModule}.
 *
 * @see docs/v2/06-loaders-and-data.md
 * @see docs/v2/10-isr-hybrid-and-prerender.md
 * @see docs/v2/12-seo-head-sitemap-images.md
 */
export type PageModuleObject = {
  /** Route component (required when not using a bare default export). */
  default: Kiru.Component<any>

  /**
   * Parallel route slots for this page. Use `defineInterceptors({ … })`.
   * @see defineInterceptors
   */
  interceptors?: ReturnType<typeof defineInterceptors>

  /**
   * Page data loader (`loader`, `serverLoader`, `clientLoader`, or `staticLoader`).
   * Read by `readPageLoadExport` on navigations and SSR.
   */
  load?: KiruLoader

  /**
   * Per-page document head (`defineHeadContent`). Merged over route-tree `head`.
   * Read by `readPageHeadExport`.
   */
  head?: KiruPageHead

  /**
   * Hybrid prerender / ISR (`defineISR`). Build + SSR only; not supported on Cloudflare Workers.
   * Read by `readRouteISRExport`.
   */
  isr?: KiruISRConfig

  /**
   * Build-time path expansion for dynamic **static** segments.
   * Read at SSG prerender only.
   */
  generateStaticParams?: GenerateStaticParams

  /**
   * Build-time path expansion for routes in `site.config` `sitemap.include`.
   * Read at sitemap generation only.
   */
  generateSitemapParams?: GenerateSitemapParams
}

/**
 * Leaf page module — bare default export or {@link PageModuleObject}.
 * Used as the resolved value of {@link PageLoader}.
 */
export type PageModule = Kiru.Component<any> | PageModuleObject

/** Dynamic `import()` of a leaf page module (`component` in the route tree). */
export type PageLoader = () => Promise<PageModule>

/** Dynamic `import()` of a layout module (`layout.tsx`). */
export type LayoutLoader = () => Promise<LayoutModule>

/** Dynamic `import()` of an error boundary module (`error.tsx`). */
export type ErrorLoader = () => Promise<ErrorModule>

/** Dynamic `import()` of a not-found module (`not-found.tsx`). */
export type NotFoundLoader = () => Promise<NotFoundModule>

/**
 * Resolved SEO / document metadata (after route-tree layers are applied).
 *
 * Author with {@link RouteHeadMetaInput} on scopes/routes. Page `export const head` /
 * `defineHeadContent` can still adjust at runtime (loader-aware).
 */
export interface RouteHeadMeta {
  title?: string
  description?: string
  /** Serialized as `<meta name="keywords" content="…" />` (comma-separated if an array). */
  keywords?: string | readonly string[]
  robots?: string
  /** Absolute or root-relative URL */
  canonical?: string
  openGraph?: {
    title?: string
    description?: string
    image?: string
    url?: string
  }
  twitter?: {
    card?: string
    title?: string
    description?: string
    image?: string
  }
  /** Raw `<meta>` attributes per row, e.g. `{ name: "theme-color", content: "#000" }` */
  extraMeta?: Array<Record<string, string>>
  /**
   * `<link>` rows, e.g. `{ rel: "icon", href: "/favicon.ico" }`.
   * Font preload: `{ rel: "preload", as: "font", href, type: "font/woff2", crossOrigin: "anonymous" }`.
   * @see docs/router/tier-3-wave-1.md#assets
   */
  links?: Array<Record<string, string>>
  /** Structured data objects serialized as `application/ld+json` script tags. */
  jsonLd?: Record<string, unknown> | Array<Record<string, unknown>>
}

export type { RouterPathPolicy, TrailingSlashPolicy } from "./pathPolicy.js"

/** Committed route location (`pathname` + dynamic `params`). */
export interface RouteLocation {
  pathname: string
  params: Record<string, string>
}

/** Full location snapshot for in-flight navigation UI and middleware `to` / `from`. */
export interface RouteLocationSnapshot {
  pathname: string
  params: Record<string, string>
  query: Record<string, string[]>
  hash: string
}

/** Active client navigation while `router.isNavigating` is true. */
export interface CurrentNavigation {
  from: RouteLocationSnapshot | null
  to: RouteLocationSnapshot
}

export type NavigationRedirect =
  | string
  | {
      path: string
      replace?: boolean
    }

export type NavigationGuardReturn =
  | void
  | true
  | false
  | NavigationRedirect
  | Promise<void | true | false | NavigationRedirect>

/**
 * CSR-only component guard (`onBeforeRouteLeave`, etc.).
 *
 * Not run on SSR. Prefer {@link RouteMiddleware} for auth and policy.
 */
export type NavigationGuard = (
  to: RouteLocation,
  from: RouteLocation | null
) => NavigationGuardReturn

export type NavigationFailure =
  | { type: "cancelled" }
  | { type: "redirect"; to: NavigationRedirect }
  | { type: "error"; error: unknown }

/** Runs after each client navigation (including redirects and errors). */
export type AfterEachHook = (
  to: RouteLocation,
  from: RouteLocation | null,
  failure?: NavigationFailure
) => void

/**
 * Full leaf route config for {@link createRoute}.
 *
 * Shorthand: pass a {@link PageLoader} alone for `component` only.
 */
export interface RouteDefinitionConfig {
  component: PageLoader
  /**
   * When true, route is eligible for SSG prerender and static path discovery.
   * Scope `static: true` applies to all descendant leaves unless overridden.
   */
  static?: boolean
  head?: RouteHeadMetaInput
  meta?: RouteMetaInput
  middleware?: RouteMiddlewareInput
  /** Error boundary module for render failures on this leaf (and below in the outlet). */
  error?: ErrorLoader
}

export type RouteConfigModule<T extends Record<string, unknown>> = {
  default?: T
  config?: T
} & Record<string, unknown>

export type RouteConfigLoader<T extends Record<string, unknown>> =
  () => Promise<RouteConfigModule<T>>

/**
 * Metadata for file-based `{page}.config.ts` / `index.config.ts`.
 *
 * The page file always supplies `component`. Export `default` or named `config`:
 *
 * ```ts
 * import type { RoutePageConfig } from "kiru/router"
 *
 * export default { static: true, head: { title: "About" } } satisfies RoutePageConfig
 * ```
 *
 * @see docs/router/file-based-routes.md
 */
export type RoutePageConfig = Omit<RouteDefinitionConfig, "component">

/** Authoring-time leaf route node (`kind: "route"`). */
export interface RouteDefinition {
  kind: "route"
  method: "GET"
  path: string
  component: PageLoader
  /**
   * Lazy config module loader for this leaf.
   *
   * When present, it is mutually exclusive with inline `static`, `head`, `meta`,
   * `middleware`, and `error` on the same node (enforced by authoring helpers).
   */
  config?: RouteConfigLoader<RoutePageConfig>
  static?: boolean
  head?: RouteHeadMetaInput
  meta?: RouteMetaInput
  middleware?: RouteMiddlewareInput
  error?: ErrorLoader
}

/**
 * Nested layout branch in the route tree.
 *
 * Wraps `children` with optional layout, middleware, and shared `head` / `meta`.
 */
export interface RouteScopeDefinition {
  kind: "scope"
  static?: boolean
  layout?: LayoutLoader
  notFound?: NotFoundLoader
  /**
   * Lazy config module loader for this scope.
   *
   * When present, it is mutually exclusive with inline `static`, `head`, `meta`,
   * `middleware`, and `error` on the same node (enforced by authoring helpers).
   */
  config?: RouteConfigLoader<RouteScopeConfig>
  head?: RouteHeadMetaInput
  meta?: RouteMetaInput
  middleware?: RouteMiddlewareInput
  error?: ErrorLoader
  children: RouteNodeDefinition[]
}

/**
 * Metadata for file-based `scope.config.ts` per directory.
 *
 * `layout`, `notFound`, and `children` normally come from FBR conventions and
 * codegen; you may set `layout` / `notFound` here when not using co-located files.
 * Co-located `layout.tsx` / `not-found.tsx` override config when both exist.
 *
 * ```ts
 * import type { RouteScopeConfig } from "kiru/router"
 *
 * export const config: RouteScopeConfig = {
 *   static: true,
 *   meta: { requiresAuth: true },
 * }
 * ```
 *
 * @see docs/router/file-based-routes.md
 */
export type RouteScopeConfig = Omit<
  RouteScopeDefinition,
  "kind" | "children" | "layout" | "notFound"
> & {
  layout?: LayoutLoader
  notFound?: NotFoundLoader
}

export type RouteNodeDefinition = RouteDefinition | RouteScopeDefinition

/**
 * Authoring-time route tree passed to {@link createRouteTree}.
 *
 * The root is always a scope; register leaf paths on `RouteTree` for typed
 * `Link` / `navigate`.
 */
export interface RouteTreeDefinition {
  root: RouteScopeDefinition
}

/** One ancestor scope on a {@link CompiledRoute} (outer → inner). */
export interface CompiledRouteScope {
  id: string
  static: boolean
  layout?: LayoutLoader
  notFound?: NotFoundLoader
  /** Optional lazy config module for this scope. */
  config?: RouteConfigLoader<RouteScopeConfig>
  /** Resolved head for this scope (ancestor chain + this layer). */
  head: RouteHeadMeta
  /** Resolved meta for this scope (ancestor chain + this layer). */
  meta: RouteMeta
  /** Resolved middleware chain for this scope (ancestor chain + this layer). */
  middleware: RouteMiddleware[]
  error?: ErrorLoader
}

/**
 * Normalized leaf route after {@link compileRouteTree}.
 *
 * Used by `matchRoute`, CSR router, SSR renderer, and static path generation.
 */
export interface CompiledRoute {
  id: string
  method: "GET"
  path: string
  pattern: RegExp
  segments: string[]
  score: number
  params: string[]
  static: boolean
  component: PageLoader
  /** Optional lazy config module for this leaf. */
  config?: RouteConfigLoader<RoutePageConfig>
  /** Ancestor scopes from root to parent (inclusive). */
  scopes: CompiledRouteScope[]
  /** Resolved scope + leaf declarative head (before page export merge). */
  head: RouteHeadMeta
  /** Resolved scope + leaf {@link RouteMeta}. */
  meta: RouteMeta
  /** Resolved middleware chain (ancestor scopes + leaf). */
  middleware: RouteMiddleware[]
  error?: ErrorLoader
}

/**
 * Output of {@link compileRouteTree} — the runtime routing table.
 */
export interface RouteManifest {
  routes: CompiledRoute[]
  /** True when the root scope defines `notFound` (used for SSG `404.html`). */
  rootHasNotFound?: boolean
  /** Root layout loader (SSR error UI when {@link rootError} runs without a matched route). */
  rootLayout?: LayoutLoader
  /** Root scope `error` module for failures with no usable {@link CompiledRoute}. */
  rootError?: ErrorLoader
}

/** Result of matching a URL against a {@link RouteManifest}. */
export interface RouteMatch {
  route: CompiledRoute
  params: Record<string, string>
  /** Pathname used for the match (after `baseUrl` / locale stripping). */
  pathname: string
}

/** Resolved document metadata for SSR/SSG (after template params). */
export interface DocumentHead {
  /** HTML fragment safe to inject inside `<head>` (no wrapper). */
  headHtml: string
  /** Plain title for quick access */
  title?: string
  /** Optional extra head slots from the HTML template compiler */
  headEndHtml?: string
  bodyEndHtml?: string
}

/** Streaming SSR response body. */
export interface StreamRenderResult {
  status: number
  headers: Record<string, string>
  body: ReadableStream<string>
}

/** Buffered SSR/SSG HTML response. */
export interface RenderResult {
  status: number
  headers: Record<string, string>
  body: string
}

/** Outcome of `router.navigate()` / `setQuery` / `setHash`. */
export type NavigationResult =
  | { status: "committed" }
  | { status: "intercepted" }
  | { status: "cancelled" }
  | { status: "redirected"; to: NavigationRedirect }
  | { status: "errored"; error: unknown }

/** Active soft intercept (URL = target, outlet = background). */
export type RouteInterceptState = {
  registrationId: number
  backgroundMatch: RouteMatch
  targetMatch: RouteMatch
  data: unknown | null
  error: Error | null
}

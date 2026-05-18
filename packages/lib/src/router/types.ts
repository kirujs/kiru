export type RouteModule = { default: Kiru.Component<any> } | Kiru.Component<any>
export type RouteLoader = () => Promise<RouteModule>

/** Props passed to SSR `error` route modules after a thrown render failure. */
export interface ErrorPageProps {
  error: Error
}

export type ErrorPage = Kiru.Component<ErrorPageProps>

/** Coerce any thrown value into `Error` for {@link ErrorPageProps}. */
export function toRenderError(thrown: unknown): Error {
  if (thrown instanceof Error) return thrown
  return new Error(String(thrown))
}

/**
 * Per-request context for loaders, actions, and components.
 *
 * Defaults to `{}` on pure CSR/SSG. SSR injects per-request values via
 * `createRenderer({ context })` and hydrates them into `RequestContextProvider`.
 * There is no client API to push session changes into loader context after hydration.
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

export interface GenerateStaticParamsContext {
  params: Record<string, string>
}

/** Used for static routes. */
export type GenerateStaticParams = (
  ctx: GenerateStaticParamsContext
) => Promise<Array<Record<string, string>>> | Array<Record<string, string>>

/** Used for `sitemap.include` routes. */
export type GenerateSitemapParams = (
  ctx: GenerateSitemapParamsContext
) => Promise<Array<Record<string, string>>> | Array<Record<string, string>>
export type GenerateSitemapParamsContext = GenerateStaticParamsContext

/** Declarative SEO / document metadata (layout + route merge; child overrides). */
export interface RouteHeadMeta {
  title?: string
  /** When set with `title`, final title is `titleTemplate.replace("%s", title)` (e.g. `"%s | MyApp"`). */
  titleTemplate?: string
  description?: string
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
  /** Raw &lt;meta&gt; attributes per row, e.g. `{ name: "theme-color", content: "#000" }` */
  extraMeta?: Array<Record<string, string>>
  /**
   * &lt;link&gt; rows, e.g. `{ rel: "icon", href: "/favicon.ico" }` or `{ rel: "preload", href: "/font.woff2", as: "font" }`.
   */
  links?: Array<Record<string, string>>
  /** Structured data objects serialized as `application/ld+json` script tags. */
  jsonLd?: Record<string, unknown> | Array<Record<string, unknown>>
}

export type { RouterPathPolicy, TrailingSlashPolicy } from "./pathPolicy.js"

export interface RouteLocation {
  pathname: string
  params: Record<string, string>
}

/** Full location snapshot for in-flight navigation UI. */
export interface RouteLocationSnapshot {
  pathname: string
  params: Record<string, string>
  query: Record<string, string[]>
  hash: string
}

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

export type NavigationGuard = (
  to: RouteLocation,
  from: RouteLocation | null
) => NavigationGuardReturn

export type NavigationFailure =
  | { type: "cancelled" }
  | { type: "redirect"; to: NavigationRedirect }
  | { type: "error"; error: unknown }

export type AfterEachHook = (
  to: RouteLocation,
  from: RouteLocation | null,
  failure?: NavigationFailure
) => void

export interface RouteDefinitionConfig {
  component: RouteLoader
  static?: boolean
  head?: RouteHeadMeta
  beforeEnter?: NavigationGuard | NavigationGuard[]
  /**
   * Runs after the target route module is loaded and before the URL commits (CSR).
   * On SSR, runs after the route module is loaded and before render.
   */
  beforeActivate?: NavigationGuard | NavigationGuard[]
  /** Arbitrary route metadata (merged shallowly from ancestor scopes). */
  meta?: Record<string, unknown>
  /** Error UI module for this route (wrapped around subtree when render throws). */
  error?: RouteLoader
}

export interface RouteDefinition {
  kind: "route"
  method: "GET"
  path: string
  component: RouteLoader
  static?: boolean
  head?: RouteHeadMeta
  beforeEnter?: NavigationGuard | NavigationGuard[]
  beforeActivate?: NavigationGuard | NavigationGuard[]
  meta?: Record<string, unknown>
  error?: RouteLoader
}

export interface RouteScopeDefinition {
  kind: "scope"
  static?: boolean
  layout?: RouteLoader
  notFound?: RouteLoader
  head?: RouteHeadMeta
  meta?: Record<string, unknown>
  error?: RouteLoader
  children: RouteNodeDefinition[]
}

export type RouteNodeDefinition = RouteDefinition | RouteScopeDefinition

export interface RouteBuilder {
  page(
    path: string,
    value: RouteLoader | RouteDefinitionConfig
  ): RouteDefinition
  scope(config: {
    static?: boolean
    layout?: RouteLoader
    notFound?: RouteLoader
    head?: RouteHeadMeta
    meta?: Record<string, unknown>
    error?: RouteLoader
    children: RouteNodeDefinition[]
  }): RouteScopeDefinition
}

export interface RouteTreeDefinition {
  root: RouteScopeDefinition
}

export interface CompiledRouteScope {
  id: string
  static: boolean
  layout?: RouteLoader
  notFound?: RouteLoader
  head?: RouteHeadMeta
  meta?: Record<string, unknown>
  error?: RouteLoader
}

export interface CompiledRoute {
  id: string
  method: "GET"
  path: string
  pattern: RegExp
  segments: string[]
  score: number
  params: string[]
  static: boolean
  component: RouteLoader
  scopes: CompiledRouteScope[]
  /** Merged from ancestor scopes and this route */
  head: RouteHeadMeta
  /** Merged shallow meta from scopes + route */
  meta: Record<string, unknown>
  beforeEnter?: NavigationGuard[]
  beforeActivate?: NavigationGuard[]
  error?: RouteLoader
}

export interface RouteManifest {
  routes: CompiledRoute[]
  /** True when the root scope defines `notFound` (used for SSG `404.html`). */
  rootHasNotFound?: boolean
  /** Root layout loader (SSR error UI when {@link rootError} runs without a matched route). */
  rootLayout?: RouteLoader
  /** Root scope `error` module for failures with no usable {@link CompiledRoute}. */
  rootError?: RouteLoader
}

export interface RouteMatch {
  route: CompiledRoute
  params: Record<string, string>
  pathname: string
}

/** Resolved document metadata for SSR/SSG (after template params). */
export interface DocumentHead {
  /** HTML fragment safe to inject inside &lt;head&gt; (no wrapper). */
  headHtml: string
  /** Plain title for quick access */
  title?: string
  /** Optional extra head slots from the HTML template compiler */
  headEndHtml?: string
  bodyEndHtml?: string
}

export interface StreamRenderResult {
  status: number
  headers: Record<string, string>
  body: ReadableStream<string>
}

export interface RenderResult {
  status: number
  headers: Record<string, string>
  body: string
}

export type NavigationResult =
  | { status: "committed" }
  | { status: "cancelled" }
  | { status: "redirected"; to: NavigationRedirect }
  | { status: "errored"; error: unknown }

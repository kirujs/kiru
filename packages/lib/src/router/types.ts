export type RouteModule = { default: Kiru.FC<any> } | Kiru.FC<any>
export type RouteLoader = () => Promise<RouteModule>

/**
 * Custom per-request context for SSR/hydration.
 *
 * Users can augment this interface:
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

export type GenerateStaticParams = (
  ctx: GenerateStaticParamsContext
) => Promise<Array<Record<string, string>>> | Array<Record<string, string>>

/** Declarative SEO / document metadata (layout + route merge; child overrides). */
export interface RouteHeadMeta {
  title?: string
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
}

export interface RouteLocation {
  pathname: string
  params: Record<string, string>
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
  generateStaticParams?: GenerateStaticParams
  head?: RouteHeadMeta
  beforeEnter?: NavigationGuard | NavigationGuard[]
}

export interface RouteDefinition {
  kind: "route"
  method: "GET"
  path: string
  component: RouteLoader
  static?: boolean
  generateStaticParams?: GenerateStaticParams
  head?: RouteHeadMeta
  beforeEnter?: NavigationGuard | NavigationGuard[]
}

export interface RouteScopeDefinition {
  kind: "scope"
  static?: boolean
  layout?: RouteLoader
  notFound?: RouteLoader
  head?: RouteHeadMeta
  children: RouteNodeDefinition[]
}

export type RouteNodeDefinition = RouteDefinition | RouteScopeDefinition

export interface RouteBuilder {
  get(path: string, value: RouteLoader | RouteDefinitionConfig): RouteDefinition
  scope(config: {
    static?: boolean
    layout?: RouteLoader
    notFound?: RouteLoader
    head?: RouteHeadMeta
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
  generateStaticParams?: GenerateStaticParams
  component: RouteLoader
  scopes: CompiledRouteScope[]
  /** Merged from ancestor scopes and this route */
  head: RouteHeadMeta
  beforeEnter?: NavigationGuard[]
}

export interface RouteManifest {
  routes: CompiledRoute[]
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

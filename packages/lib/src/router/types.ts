export type RouteModule = { default: Kiru.FC<any> } | Kiru.FC<any>
export type RouteLoader = () => Promise<RouteModule>

export interface GenerateStaticParamsContext {
  params: Record<string, string>
}

export type GenerateStaticParams = (
  ctx: GenerateStaticParamsContext
) => Promise<Array<Record<string, string>>> | Array<Record<string, string>>

/** Declarative SEO / document metadata (layout + route merge; child overrides). */
export interface RouteMeta {
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

export interface RouteDefinitionConfig {
  component: RouteLoader
  static?: boolean
  generateStaticParams?: GenerateStaticParams
  meta?: RouteMeta
}

export interface RouteDefinition {
  kind: "route"
  method: "GET"
  path: string
  component: RouteLoader
  static?: boolean
  generateStaticParams?: GenerateStaticParams
  meta?: RouteMeta
}

export interface RouteScopeDefinition {
  kind: "scope"
  static?: boolean
  layout?: RouteLoader
  notFound?: RouteLoader
  meta?: RouteMeta
  children: RouteNodeDefinition[]
}

export type RouteNodeDefinition = RouteDefinition | RouteScopeDefinition

export interface RouteBuilder {
  get(path: string, value: RouteLoader | RouteDefinitionConfig): RouteDefinition
  scope(config: {
    static?: boolean
    layout?: RouteLoader
    notFound?: RouteLoader
    meta?: RouteMeta
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
  meta?: RouteMeta
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
  meta: RouteMeta
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
  document?: DocumentHead
}

export interface RenderResult {
  status: number
  headers: Record<string, string>
  body: string
  document?: DocumentHead
}

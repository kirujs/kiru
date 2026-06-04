import type { RouteDefinition } from "./types.js"

/** Split a route path into URL segments (no leading slash). */
type SplitSegments<P extends string> = P extends `/${infer Rest}`
  ? Rest extends ""
    ? []
    : SplitRest<Rest>
  : SplitRest<P>

type SplitRest<R extends string> = R extends `${infer Head}/${infer Tail}`
  ? Head extends ""
    ? SplitRest<Tail>
    : [Head, ...SplitRest<Tail>]
  : R extends ""
  ? []
  : [R]

type SegmentParams<S extends string> = S extends `[[...${infer K}]]`
  ? { [Key in K]: string | undefined }
  : S extends `[...${infer K}]`
  ? { [Key in K]: string }
  : S extends `[[${infer K}]]`
  ? { [Key in K]?: string }
  : S extends `[${infer K}]`
  ? { [Key in K]: string }
  : EmptyRouteParams

type UnionToIntersection<U> = (
  U extends unknown ? (arg: U) => void : never
) extends (arg: infer I) => void
  ? I
  : never

/** No dynamic segments on this path (use `{}` so `keyof` is `never`, not `string`). */
export type EmptyRouteParams = {}

/** Dynamic path params inferred from a logical route path. */
export type RouteParams<P extends string> = P extends "/"
  ? EmptyRouteParams
  : UnionToIntersection<
      {
        [K in keyof SplitSegments<P>]: SegmentParams<
          SplitSegments<P>[K] & string
        >
      }[number]
    > extends infer R
  ? keyof R extends never
    ? EmptyRouteParams
    : R
  : EmptyRouteParams

export type HasRouteParams<P extends string> =
  keyof RouteParams<P> extends never ? false : true

/** Route node with a const path literal for registry typing. */
export type CreatedRoute<P extends string = string> = RouteDefinition & {
  readonly path: P
}

export type CreatedRouteScope = import("./types.js").RouteScopeDefinition

export type RouteTreeChild = CreatedRoute<string> | CreatedRouteScope

/**
 * Augment for type-safe paths and params:
 *
 * ```ts
 * declare module "kiru/router" {
 *   interface RouteTree {
 *     routes: [typeof r0, typeof r1]
 *   }
 * }
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface RouteTree {}

type RegisteredRoutes = RouteTree extends {
  routes: infer R extends readonly CreatedRoute<string>[]
}
  ? R
  : readonly never[]

type AllRouteNodes = RegisteredRoutes[number]

/** Union of registered logical paths; `never` when no registry is augmented. */
export type AppRoutePath = [AllRouteNodes] extends [never]
  ? never
  : Extract<AllRouteNodes, CreatedRoute<string>>["path"]

export type ParamsForPath<P extends AppRoutePath> = RouteParams<P>

export type IsRouteRegistryConfigured = [AppRoutePath] extends [never]
  ? false
  : true

/** Navigate target: logical path or any string when registry is empty. */
export type NavigatePath = IsRouteRegistryConfigured extends true
  ? AppRoutePath
  : string

export type NavigateParamsOption<P extends string> =
  HasRouteParams<P> extends true ? { params: RouteParams<P> } : {}

export type RouterNavigateInput<P extends NavigatePath = NavigatePath> =
  IsRouteRegistryConfigured extends true
    ? P | ({ pathname: P } & NavigateParamsOption<P>)
    : string

export type RouterNavigateCallOptions =
  import("./i18n/augmentation.js").RouterNavigateOptions & {
    params?: Record<string, string | undefined>
    /** When false, skip route interceptors for this navigation. Default true. */
    intercept?: boolean
  }

export type InterceptLoadContext<
  Params extends Record<string, string | undefined>
> = {
  params: Params
  location: import("./types.js").RouteLocation
  signal: AbortSignal
}

export type InterceptRenderContext<
  Params extends Record<string, string | undefined>
> = InterceptLoadContext<Params> & {
  restore: () => void
  data: unknown | undefined
}

export type InterceptorOptions<P extends string> = {
  from?: string
  load?: (
    ctx: InterceptLoadContext<RouteParams<P>>
  ) => unknown | Promise<unknown>
  render: (ctx: InterceptRenderContext<RouteParams<P>>) => JSX.Element
}

export type InterceptorHandle = {
  Outlet: Kiru.Component
  isActive: Kiru.Signal<boolean>
  isPending: Kiru.Signal<boolean>
  restore: () => void
}

function encodeParamValue(value: string): string {
  return encodeURIComponent(value)
}

/**
 * Build a URL pathname from a logical route pattern and params.
 * @throws when required params are missing or catch-all is not last
 */
export function interpolateRoutePath(
  path: string,
  params: Record<string, string | undefined> = {}
): string {
  if (path === "/") return "/"
  const segments = path.slice(1).split("/")
  const out: string[] = []

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i]!
    const optionalCatchAll = segment.match(/^\[\[\.\.\.([^/\]]+)\]\]$/)
    if (optionalCatchAll) {
      if (i !== segments.length - 1) {
        throw new Error(
          `[[...${optionalCatchAll[1]}]] must be the last segment in route path`
        )
      }
      const key = optionalCatchAll[1]!
      const raw = params[key]
      if (raw === undefined || raw === "")
        return out.length ? `/${out.join("/")}` : "/"
      const parts = raw.split("/").filter(Boolean)
      out.push(...parts.map(encodeParamValue))
      continue
    }
    const catchAll = segment.match(/^\[\.\.\.([^/\]]+)\]$/)
    if (catchAll) {
      if (i !== segments.length - 1) {
        throw new Error(
          `[...${catchAll[1]}] must be the last segment in route path`
        )
      }
      const key = catchAll[1]!
      const raw = params[key]
      if (raw === undefined || raw === "") {
        throw new Error(`Missing required param "${key}" for route ${path}`)
      }
      const parts = raw.split("/").filter(Boolean)
      out.push(...parts.map(encodeParamValue))
      continue
    }
    const optional = segment.match(/^\[\[([^/\]]+)\]\]$/)
    if (optional) {
      const key = optional[1]!
      const raw = params[key]
      if (raw !== undefined && raw !== "") out.push(encodeParamValue(raw))
      continue
    }
    const dynamic = segment.match(/^\[([^/\]]+)\]$/)
    if (dynamic) {
      const key = dynamic[1]!
      const raw = params[key]
      if (raw === undefined || raw === "") {
        throw new Error(`Missing required param "${key}" for route ${path}`)
      }
      out.push(encodeParamValue(raw))
      continue
    }
    out.push(segment)
  }

  return `/${out.join("/")}`
}

/** Resolve navigate `to` + optional `params` into a pathname string. */
export function resolveNavigateTarget(
  to: RouterNavigateInput,
  params?: Record<string, string | undefined>
): string {
  if (typeof to === "string") {
    if (params && Object.keys(params).length > 0) {
      return interpolateRoutePath(to, params)
    }
    return to
  }
  const {
    pathname,
    params: nested,
    ...rest
  } = to as {
    pathname: string
    params?: Record<string, string | undefined>
  }
  void rest
  return interpolateRoutePath(pathname, nested ?? params)
}

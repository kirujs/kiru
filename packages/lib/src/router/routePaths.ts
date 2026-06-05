import type { CustomRequestContext, RouteDefinition } from "./types.js"
import { toRenderError } from "./types.js"

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
  context: CustomRequestContext
}

/** Load outcome passed to `render` (discriminated on `error`, same shape as page `data` / `error` props). */
export type InterceptLoadResult<Data> =
  | { data: Data; error: null }
  | { data: null; error: Error }

export function buildInterceptSuccessResult<Data>(
  data: Data
): InterceptLoadResult<Data> {
  return { data, error: null }
}

export function buildInterceptErrorResult(
  err: unknown
): InterceptLoadResult<never> {
  return { data: null, error: toRenderError(err) }
}

/** Normalize stored intercept state into a render/load result union. */
export function interceptLoadResultFromState(
  state: Pick<{ data: unknown | null; error: Error | null }, "data" | "error">
): InterceptLoadResult<unknown> {
  if (state.error !== null) {
    return { data: null, error: state.error }
  }
  return buildInterceptSuccessResult(state.data)
}

/** When `RouteTree` is augmented, only registered paths are accepted; otherwise any string. */
export type RegisteredRoutePath<P extends string> =
  IsRouteRegistryConfigured extends true
    ? P extends NavigatePath
      ? P
      : never
    : P

export type InterceptRenderContext<
  Params extends Record<string, string | undefined>,
  Data = unknown
> = InterceptLoadContext<Params> & {
  restore: () => void
  reload: () => void
} & InterceptLoadResult<Data>

/** Bivariant render callback (accepts narrower implementations under `strictFunctionTypes`). */
export type InterceptorRenderFn<P extends string, Data = unknown> = {
  bivariance(
    ctx: InterceptRenderContext<RouteParams<P>, Data>
  ): JSX.Element
}["bivariance"]

export type InterceptorOptions<
  P extends string,
  Data = unknown
> = {
  from?: string
  load?: (
    ctx: InterceptLoadContext<RouteParams<P>>
  ) => Data | Promise<Data>
  render: InterceptorRenderFn<P, Data>
}

/** Declarative interceptor config for `defineInterceptors`. */
export type RouteInterceptorDefinition<
  P extends string = string,
  Data = unknown
> = {
  path: P
  from?: string
  load?: (
    ctx: InterceptLoadContext<RouteParams<P>>
  ) => Data | Promise<Data>
  render: InterceptorRenderFn<P, Data>
}

export type InterceptorHandle = {
  Outlet: Kiru.Component
  isActive: Kiru.Signal<boolean>
  isPending: Kiru.Signal<boolean>
  restore: () => void
  /** Slot key from `defineInterceptors`. */
  readonly slot: string
  /** Target route path pattern. */
  readonly path: NavigatePath
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

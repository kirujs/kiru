import { mergeRouteHead } from "./meta.js"
import type {
  RouteHeadMeta,
  RouteHeadMetaInput,
  RouteMeta,
  RouteMetaInput,
  RouteMiddleware,
  RouteMiddlewareInput,
  RouteMiddlewareLayer,
} from "./types.js"

function cloneRouteHead(head: RouteHeadMeta): RouteHeadMeta {
  return mergeRouteHead({}, head)
}

/**
 * Apply one route-tree meta layer.
 *
 * - Plain object: replaces inherited (no shallow merge).
 * - Function: receives inherited meta from ancestor scopes; return value is used as-is.
 */
export function resolveRouteMetaLayer(
  inherited: RouteMeta,
  input?: RouteMetaInput
): RouteMeta {
  if (input === undefined) return { ...inherited }
  if (typeof input === "function") return input({ ...inherited })
  return { ...input }
}

/**
 * Apply one route-tree head layer.
 *
 * - Plain object: replaces inherited (no merge with `mergeRouteHead`).
 * - Function: receives inherited head from ancestor scopes; return value is used as-is.
 */
export function resolveRouteHeadLayer(
  inherited: RouteHeadMeta,
  input?: RouteHeadMetaInput
): RouteHeadMeta {
  if (input === undefined) return cloneRouteHead(inherited)
  if (typeof input === "function") return input(cloneRouteHead(inherited))
  return cloneRouteHead(input)
}

/**
 * Apply one route-tree middleware layer.
 *
 * - **Array** (or single handler): replaces inherited chain.
 * - **Function:** receives inherited handlers from ancestor scopes; return value is used as-is.
 *   Distinguished from a lone {@link RouteMiddleware} by calling with `inherited` and checking for an array result.
 */
export function resolveRouteMiddlewareLayer(
  inherited: RouteMiddleware[],
  input?: RouteMiddlewareInput
): RouteMiddleware[] {
  if (input === undefined) return [...inherited]
  if (Array.isArray(input)) return [...input]
  if (typeof input === "function") {
    const out = (input as RouteMiddlewareLayer)(inherited)
    if (Array.isArray(out)) return [...out]
    return [input as RouteMiddleware]
  }
  return [input]
}

/** Resolved meta/head/middleware from the innermost scope on a matched branch (ancestor chain). */
export function inheritedFromScopes(
  parents: ReadonlyArray<{
    meta: RouteMeta
    head: RouteHeadMeta
    middleware: RouteMiddleware[]
  }>
): {
  meta: RouteMeta
  head: RouteHeadMeta
  middleware: RouteMiddleware[]
} {
  const last = parents[parents.length - 1]
  return {
    meta: last ? { ...last.meta } : {},
    head: last ? cloneRouteHead(last.head) : {},
    middleware: last ? [...last.middleware] : [],
  }
}

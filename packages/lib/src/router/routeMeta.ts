import type { RouteMatch, RouteMeta, RouteMiddleware } from "./types.js"

/** Resolved {@link RouteMeta} for a match (computed at {@link compileRouteTree}). */
export function mergeRouteMeta(match: RouteMatch | null): RouteMeta {
  if (!match) return {}
  return { ...match.route.meta }
}

/** Resolved middleware chain for a match (computed at {@link compileRouteTree}). */
export function collectMiddlewareChain(match: RouteMatch | null): RouteMiddleware[] {
  if (!match) return []
  return [...match.route.middleware]
}

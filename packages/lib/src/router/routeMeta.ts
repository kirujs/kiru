import type { RouteMatch, RouteMeta, RouteMiddleware } from "./types.js"

function mergeShallowMeta(
  ...layers: Array<Partial<RouteMeta> | undefined>
): RouteMeta {
  const out: RouteMeta = {}
  for (const layer of layers) {
    if (!layer) continue
    for (const [k, v] of Object.entries(layer)) {
      ;(out as Record<string, unknown>)[k] = v
    }
  }
  return out
}

export function mergeRouteMeta(match: RouteMatch | null): RouteMeta {
  if (!match) return {}
  let meta: RouteMeta = {}
  for (const scope of match.route.scopes) {
    meta = mergeShallowMeta(meta, scope.meta)
  }
  return mergeShallowMeta(meta, match.route.meta)
}

export function collectMiddlewareChain(match: RouteMatch | null): RouteMiddleware[] {
  if (!match) return []
  const chain: RouteMiddleware[] = []
  for (const scope of match.route.scopes) {
    if (scope.middleware?.length) chain.push(...scope.middleware)
  }
  if (match.route.middleware?.length) chain.push(...match.route.middleware)
  return chain
}

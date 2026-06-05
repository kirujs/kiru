import { resolveRouteConfig } from "./resolveRouteConfig.js"
import {
  inheritedFromScopes,
  resolveRouteHeadLayer,
  resolveRouteMetaLayer,
  resolveRouteMiddlewareLayer,
} from "./routeLayers.js"
import type {
  CompiledRoute,
  CompiledRouteScope,
  RouteMatch,
  RoutePageConfig,
  RouteScopeConfig,
} from "./types.js"

type ResolvedScopeLayers = Pick<
  CompiledRouteScope,
  "head" | "meta" | "middleware" | "static"
>

type ResolvedLeafLayers = Pick<
  CompiledRoute,
  "head" | "meta" | "middleware" | "static"
>

type ResolvedLayers = {
  scopes: ResolvedScopeLayers[]
  leaf: ResolvedLeafLayers
}

const resolvedByRoute = new WeakMap<CompiledRoute, ResolvedLayers>()
const inflightByRoute = new WeakMap<CompiledRoute, Promise<ResolvedLayers>>()

async function loadScopeConfig(scope: CompiledRouteScope): Promise<RouteScopeConfig> {
  if (!scope.config) return {} as RouteScopeConfig
  const mod = await scope.config()
  return resolveRouteConfig<RouteScopeConfig>(mod)
}

async function loadPageConfig(route: CompiledRoute): Promise<RoutePageConfig> {
  if (!route.config) return {} as RoutePageConfig
  const mod = await route.config()
  return resolveRouteConfig<RoutePageConfig>(mod)
}

async function resolveLayers(route: CompiledRoute): Promise<ResolvedLayers> {
  const outScopes: ResolvedScopeLayers[] = []
  let parents: Array<Pick<CompiledRouteScope, "head" | "meta" | "middleware">> = []
  let parentStatic = false

  for (const scope of route.scopes) {
    const { meta: inheritedMeta, head: inheritedHead, middleware: inheritedMw } =
      inheritedFromScopes(parents)
    const cfg = await loadScopeConfig(scope)
    const resolvedStatic = cfg.static ?? false
    parentStatic = parentStatic || resolvedStatic
    const resolvedScope: ResolvedScopeLayers = {
      static: resolvedStatic,
      head: resolveRouteHeadLayer(inheritedHead, cfg.head),
      meta: resolveRouteMetaLayer(inheritedMeta, cfg.meta),
      middleware: resolveRouteMiddlewareLayer(inheritedMw, cfg.middleware),
    }
    outScopes.push(resolvedScope)
    parents = parents.concat(resolvedScope)
  }

  const { meta: inheritedMeta, head: inheritedHead, middleware: inheritedMw } =
    inheritedFromScopes(parents)
  const pageCfg = await loadPageConfig(route)
  const inheritedStatic = parentStatic
  const resolvedLeafStatic =
    pageCfg.static === false ? false : (pageCfg.static ?? inheritedStatic)
  const leaf: ResolvedLeafLayers = {
    static: resolvedLeafStatic,
    head: resolveRouteHeadLayer(inheritedHead, pageCfg.head),
    meta: resolveRouteMetaLayer(inheritedMeta, pageCfg.meta),
    middleware: resolveRouteMiddlewareLayer(inheritedMw, pageCfg.middleware),
  }

  return { scopes: outScopes, leaf }
}

/**
 * Ensure `match.route` and `match.route.scopes` have resolved `head`/`meta`/`middleware`.
 *
 * This enables deferred layer resolution for loader-backed config modules while keeping
 * the rest of the router pipeline using the existing synchronous `match.route.*` fields.
 */
export async function ensureResolvedRouteLayersForMatch(
  match: RouteMatch | null
): Promise<void> {
  if (!match) return
  const route = match.route

  // Fast path: if there are no loader-backed config modules on this branch,
  // keep using the eagerly-compiled layers from `compileRouteTree`.
  if (!route.config && route.scopes.every((s) => !s.config)) return

  const cached = resolvedByRoute.get(route)
  if (cached) {
    for (let i = 0; i < route.scopes.length; i++) {
      const scope = route.scopes[i]
      const resolvedScope = cached.scopes[i]
      if (!resolvedScope) continue
      scope.static = resolvedScope.static
      scope.head = resolvedScope.head
      scope.meta = resolvedScope.meta
      scope.middleware = resolvedScope.middleware
    }
    route.static = cached.leaf.static
    route.head = cached.leaf.head
    route.meta = cached.leaf.meta
    route.middleware = cached.leaf.middleware
    return
  }

  const inflight = inflightByRoute.get(route)
  if (inflight) {
    const resolved = await inflight
    resolvedByRoute.set(route, resolved)
    inflightByRoute.delete(route)
    await ensureResolvedRouteLayersForMatch(match)
    return
  }

  const p = resolveLayers(route)
  inflightByRoute.set(route, p)
  const resolved = await p
  resolvedByRoute.set(route, resolved)
  inflightByRoute.delete(route)
  await ensureResolvedRouteLayersForMatch(match)
}


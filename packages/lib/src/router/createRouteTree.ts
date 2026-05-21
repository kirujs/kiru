import type {
  RouteDefinitionConfig,
  RouteLoader,
  RouteNodeDefinition,
  RouteScopeDefinition,
  RouteTreeDefinition,
} from "./types.js"
import type { CreatedRoute, CreatedRouteScope, RouteTreeChild } from "./routePaths.js"

function buildRoute<P extends string>(
  path: P,
  value: RouteLoader | RouteDefinitionConfig
): CreatedRoute<P> {
  if (!path.startsWith("/")) {
    throw new Error(`Route paths must start with '/': ${path}`)
  }
  if (typeof value === "function") {
    return {
      kind: "route",
      method: "GET",
      path,
      component: value,
    } as CreatedRoute<P>
  }
  return {
    kind: "route",
    method: "GET",
    path,
    component: value.component,
    static: value.static,
    head: value.head,
    meta: value.meta,
    middleware: value.middleware,
    error: value.error,
  } as CreatedRoute<P>
}

export function createRoute<const P extends string>(
  path: P,
  value: RouteLoader | RouteDefinitionConfig
): CreatedRoute<P> {
  return buildRoute(path, value)
}

export function createRouteScope(config: {
  static?: boolean
  layout?: RouteLoader
  notFound?: RouteLoader
  head?: import("./types.js").RouteHeadMeta
  meta?: Partial<import("./types.js").RouteMeta>
  contextStrategy?: import("./types.js").ContextStrategy
  contextPendingFallback?: import("./types.js").ContextPendingFallback
  middleware?: import("./types.js").RouteMiddleware | import("./types.js").RouteMiddleware[]
  error?: RouteLoader
  children: readonly RouteTreeChild[]
}): CreatedRouteScope {
  return {
    kind: "scope",
    static: config.static,
    layout: config.layout,
    notFound: config.notFound,
    head: config.head,
    meta: config.meta,
    contextStrategy: config.contextStrategy,
    contextPendingFallback: config.contextPendingFallback,
    middleware: config.middleware,
    error: config.error,
    children: config.children as RouteNodeDefinition[],
  }
}

export function createRouteTree(config: {
  static?: boolean
  layout?: RouteLoader
  notFound?: RouteLoader
  head?: import("./types.js").RouteHeadMeta
  meta?: Partial<import("./types.js").RouteMeta>
  contextStrategy?: import("./types.js").ContextStrategy
  contextPendingFallback?: import("./types.js").ContextPendingFallback
  middleware?: import("./types.js").RouteMiddleware | import("./types.js").RouteMiddleware[]
  error?: RouteLoader
  children: readonly RouteTreeChild[]
}): RouteTreeDefinition {
  const root: RouteScopeDefinition = {
    kind: "scope",
    static: config.static,
    layout: config.layout,
    notFound: config.notFound,
    head: config.head,
    meta: config.meta,
    contextStrategy: config.contextStrategy,
    contextPendingFallback: config.contextPendingFallback,
    middleware: config.middleware,
    error: config.error,
    children: config.children as RouteNodeDefinition[],
  }
  return { root }
}

/** Append hand-written route nodes to a generated tree root. */
export function mergeRouteTree(
  tree: RouteTreeDefinition,
  extraChildren: readonly RouteTreeChild[]
): RouteTreeDefinition {
  return {
    root: {
      ...tree.root,
      children: [
        ...tree.root.children,
        ...(extraChildren as RouteNodeDefinition[]),
      ],
    },
  }
}

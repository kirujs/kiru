import type {
  RouteDefinitionConfig,
  RouteLoader,
  RouteMiddleware,
  RouteMiddlewareInput,
  RouteMiddlewareLayer,
  RouteNodeDefinition,
  RouteScopeDefinition,
  RouteScopeConfig,
  RouteTreeDefinition,
} from "./types.js"
import type { CreatedRoute, CreatedRouteScope, RouteTreeChild } from "./routePaths.js"

type RouteScopeConfigWithChildren = Omit<RouteScopeConfig, "middleware"> & {
  children: readonly RouteTreeChild[]
}

type RouteDefinitionConfigWithMiddleware = Omit<
  RouteDefinitionConfig,
  "middleware"
>

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
  value: RouteDefinitionConfigWithMiddleware & {
    middleware?: RouteMiddleware[]
  }
): CreatedRoute<P>
export function createRoute<const P extends string>(
  path: P,
  value: RouteDefinitionConfigWithMiddleware & {
    middleware?: RouteMiddlewareLayer
  }
): CreatedRoute<P>
export function createRoute<const P extends string>(
  path: P,
  value: RouteDefinitionConfigWithMiddleware & {
    middleware?: RouteMiddleware
  }
): CreatedRoute<P>
export function createRoute<const P extends string>(
  path: P,
  value: RouteLoader | RouteDefinitionConfig
): CreatedRoute<P>
export function createRoute<const P extends string>(
  path: P,
  value: RouteLoader | RouteDefinitionConfig
): CreatedRoute<P> {
  return buildRoute(path, value)
}

export function createRouteScope(
  config: RouteScopeConfigWithChildren & { middleware?: RouteMiddleware[] }
): CreatedRouteScope
export function createRouteScope(
  config: RouteScopeConfigWithChildren & { middleware?: RouteMiddlewareLayer }
): CreatedRouteScope
export function createRouteScope(
  config: RouteScopeConfigWithChildren & { middleware?: RouteMiddleware }
): CreatedRouteScope
export function createRouteScope(
  config: RouteScopeConfigWithChildren & { middleware?: RouteMiddlewareInput }
): CreatedRouteScope
export function createRouteScope(
  config: RouteScopeConfigWithChildren & { middleware?: RouteMiddlewareInput }
): CreatedRouteScope {
  return {
    kind: "scope",
    static: config.static,
    layout: config.layout,
    notFound: config.notFound,
    head: config.head,
    meta: config.meta,
    middleware: config.middleware,
    error: config.error,
    children: config.children as RouteNodeDefinition[],
  }
}

export function createRouteTree(
  config: RouteScopeConfigWithChildren & { middleware?: RouteMiddleware[] }
): RouteTreeDefinition
export function createRouteTree(
  config: RouteScopeConfigWithChildren & { middleware?: RouteMiddlewareLayer }
): RouteTreeDefinition
export function createRouteTree(
  config: RouteScopeConfigWithChildren & { middleware?: RouteMiddleware }
): RouteTreeDefinition
export function createRouteTree(
  config: RouteScopeConfigWithChildren & { middleware?: RouteMiddlewareInput }
): RouteTreeDefinition
export function createRouteTree(
  config: RouteScopeConfigWithChildren & { middleware?: RouteMiddlewareInput }
): RouteTreeDefinition {
  const root: RouteScopeDefinition = {
    kind: "scope",
    static: config.static,
    layout: config.layout,
    notFound: config.notFound,
    head: config.head,
    meta: config.meta,
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

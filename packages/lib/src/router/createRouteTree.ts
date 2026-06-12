import type {
  RouteDefinitionConfig,
  PageLoader,
  RouteMiddleware,
  RouteMiddlewareInput,
  RouteMiddlewareLayer,
  RouteNodeDefinition,
  RouteScopeDefinition,
  RouteScopeConfig,
  RouteConfigLoader,
  RoutePageConfig,
  RouteTreeDefinition,
} from "./types.js"
import type {
  CreatedRoute,
  CreatedRouteScope,
  RouteTreeChild,
} from "./routePaths.js"

type RouteScopeConfigWithChildren = Omit<RouteScopeConfig, "middleware"> & {
  children: readonly RouteTreeChild[]
}

type RouteDefinitionConfigWithMiddleware = Omit<
  RouteDefinitionConfig,
  "middleware"
>

type RouteDefinitionConfigByLoader = {
  component: PageLoader
  config: RouteConfigLoader<RoutePageConfig>
  static?: never
  head?: never
  meta?: never
  middleware?: never
  error?: never
}

function buildRoute<P extends string>(
  path: P,
  value: PageLoader | RouteDefinitionConfig
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
  value: PageLoader | RouteDefinitionConfig | RouteDefinitionConfigByLoader
): CreatedRoute<P>
export function createRoute<const P extends string>(
  path: P,
  value: PageLoader | RouteDefinitionConfig | RouteDefinitionConfigByLoader
): CreatedRoute<P> {
  if (typeof value === "object" && value != null && "config" in value) {
    if (!path.startsWith("/")) {
      throw new Error(`Route paths must start with '/': ${path}`)
    }
    const cfg = value as RouteDefinitionConfigByLoader
    return {
      kind: "route",
      method: "GET",
      path,
      component: cfg.component,
      config: cfg.config,
    } as CreatedRoute<P>
  }
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
  config: RouteScopeConfigWithChildren & {
    config: RouteConfigLoader<RouteScopeConfig>
    static?: never
    head?: never
    meta?: never
    middleware?: never
    error?: never
  }
): CreatedRouteScope
export function createRouteScope(
  config: RouteScopeConfigWithChildren & { middleware?: RouteMiddlewareInput }
): CreatedRouteScope {
  if (typeof config === "object" && config != null && "config" in config) {
    const cfg = config as RouteScopeConfigWithChildren & {
      config: RouteConfigLoader<RouteScopeConfig>
    }
    return {
      kind: "scope",
      layout: cfg.layout,
      notFound: cfg.notFound,
      config: cfg.config,
      children: cfg.children as RouteNodeDefinition[],
    }
  }
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
  config: RouteScopeConfigWithChildren & {
    config: RouteConfigLoader<RouteScopeConfig>
    static?: never
    head?: never
    meta?: never
    middleware?: never
    error?: never
  }
): RouteTreeDefinition
export function createRouteTree(
  config: RouteScopeConfigWithChildren & { middleware?: RouteMiddlewareInput }
): RouteTreeDefinition {
  if (typeof config === "object" && config != null && "config" in config) {
    const cfg = config as RouteScopeConfigWithChildren & {
      config: RouteConfigLoader<RouteScopeConfig>
    }
    const root: RouteScopeDefinition = {
      kind: "scope",
      layout: cfg.layout,
      notFound: cfg.notFound,
      config: cfg.config,
      children: cfg.children as RouteNodeDefinition[],
    }
    return { root }
  }
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

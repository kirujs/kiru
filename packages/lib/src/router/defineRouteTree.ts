import type {
  RouteBuilder,
  RouteDefinition,
  RouteDefinitionConfig,
  RouteLoader,
  RouteScopeDefinition,
  RouteTreeDefinition,
} from "./types.js"

const routeBuilder: RouteBuilder = {
  get(
    path: string,
    value: RouteLoader | RouteDefinitionConfig
  ): RouteDefinition {
    if (!path.startsWith("/")) {
      throw new Error(`Route paths must start with '/': ${path}`)
    }
    if (typeof value === "function") {
      return {
        kind: "route",
        method: "GET",
        path,
        component: value,
      }
    }
    return {
      kind: "route",
      method: "GET",
      path,
      component: value.component,
      static: value.static,
      head: value.head,
      beforeEnter: value.beforeEnter,
      beforeActivate: value.beforeActivate,
      meta: value.meta,
      error: value.error,
    }
  },
  scope(config): RouteScopeDefinition {
    return {
      kind: "scope",
      static: config.static,
      layout: config.layout,
      notFound: config.notFound,
      head: config.head,
      meta: config.meta,
      error: config.error,
      children: config.children,
    }
  },
}

export function defineRouteTree(
  build: (r: RouteBuilder) => RouteScopeDefinition
): RouteTreeDefinition {
  const root = build(routeBuilder)
  if (root.kind !== "scope") {
    throw new Error("defineRouteTree must return a scope root")
  }
  return { root }
}

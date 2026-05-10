import { createElement } from "../element.js"
import { resolveNotFoundScopes } from "./manifest.js"
import type { RouteManifest, RouteMatch, RouteModule } from "./types.js"

export async function loadRouteTree(match: RouteMatch): Promise<{
  layoutModules: Array<RouteModule | null>
  routeModule: RouteModule
}> {
  const layoutModules = await Promise.all(
    match.route.scopes.map((scope) => scope.layout?.() ?? null)
  )
  const routeModule = await match.route.component()
  return { layoutModules, routeModule }
}

export async function loadNotFoundRouteTree(
  manifest: RouteManifest,
  pathname: string
): Promise<{
  layoutModules: Array<RouteModule | null>
  routeModule: RouteModule
} | null> {
  const scopes = resolveNotFoundScopes(manifest, pathname)
  if (!scopes) return null
  const notFoundScope = [...scopes].reverse().find((scope) => !!scope.notFound)
  if (!notFoundScope?.notFound) return null
  const [routeModule, layoutModules] = await Promise.all([
    notFoundScope.notFound(),
    Promise.all(scopes.map((scope) => scope.layout?.() ?? null)),
  ])
  return { layoutModules, routeModule }
}

/** Layout stack + page only (no RouterProvider). Matches SSR/SSG body HTML. */
export function buildRoutedSubtree(
  layoutModules: Array<RouteModule | null>,
  routeModule: RouteModule
) {
  let app = createElement(asComponent(routeModule), {})
  for (const module of layoutModules.slice().reverse()) {
    if (!module) continue
    app = createElement(asComponent(module), { children: app })
  }
  return app
}

function asComponent(module: RouteModule): Kiru.FC<any> {
  return typeof module === "function" ? module : module.default
}

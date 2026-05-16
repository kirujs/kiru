import { createElement } from "../element.js"
import { resolveNotFoundScopes } from "./manifest.js"
import type { KiruLoader, PageProps } from "./loaders.js"
import type {
  ErrorPageProps,
  RouteManifest,
  RouteMatch,
  RouteModule,
} from "./types.js"

export type LeafRouteProps =
  | ErrorPageProps
  | PageProps<KiruLoader<unknown>>
  | Record<string, never>

interface RouteTreeLoadResult {
  layoutModules: Array<RouteModule | null>
  routeModule: RouteModule
}

export async function loadRouteTree(
  match: RouteMatch
): Promise<RouteTreeLoadResult> {
  const [routeModule, ...layoutModules] = await Promise.all([
    match.route.component(),
    ...match.route.scopes.map((scope) => scope.layout?.() ?? null),
  ])
  return { layoutModules, routeModule }
}

export async function loadNotFoundRouteTree(
  manifest: RouteManifest,
  pathname: string
): Promise<RouteTreeLoadResult | null> {
  const scopes = resolveNotFoundScopes(manifest, pathname)
  if (!scopes) return null
  const notFoundScope = [...scopes].reverse().find((scope) => !!scope.notFound)
  if (!notFoundScope?.notFound) return null
  const [routeModule, ...layoutModules] = await Promise.all([
    notFoundScope.notFound(),
    ...scopes.map((scope) => scope.layout?.() ?? null),
  ])
  return { layoutModules, routeModule }
}

export async function loadErrorRouteTree(
  match: RouteMatch
): Promise<RouteTreeLoadResult | null> {
  const errorLoader = match.route.error
  if (!errorLoader) return null
  const [routeModule, ...layoutModules] = await Promise.all([
    errorLoader(),
    ...match.route.scopes.map((scope) => scope.layout?.() ?? null),
  ])
  return { layoutModules, routeModule }
}

export async function loadRootErrorRouteTree(
  manifest: RouteManifest
): Promise<RouteTreeLoadResult | null> {
  const rootError = manifest.rootError
  if (!rootError) return null
  const [routeModule, rootLayout] = await Promise.all([
    rootError(),
    manifest.rootLayout?.() ?? Promise.resolve(null),
  ])
  const layoutModules: Array<RouteModule | null> = rootLayout
    ? [rootLayout]
    : []
  return { layoutModules, routeModule }
}

/** Layout stack + page only (no RouterProvider). Matches SSR/SSG body HTML. */
export function buildRoutedSubtree(
  layoutModules: Array<RouteModule | null>,
  routeModule: RouteModule,
  leafProps?: LeafRouteProps
) {
  let app = createElement(
    asComponent(routeModule),
    (leafProps ?? {}) as Record<string, unknown>
  )
  for (const module of layoutModules.slice().reverse()) {
    if (!module) continue
    app = createElement(asComponent(module), { children: app })
  }
  return app
}

function asComponent(module: RouteModule): Kiru.Component<any> {
  return typeof module === "function" ? module : module.default
}

import { createElement } from "../element.js"
import { resolveNotFoundScopes } from "./manifest.js"
import type { KiruLoader, PageProps } from "./loaders.js"
import type {
  ErrorPageProps,
  RouteManifest,
  RouteMatch,
  RouteModule,
} from "./types.js"
import { toRenderError } from "./types.js"
import { ErrorBoundary } from "../components/index.js"

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

/** Client outlet error UI (route `error` modules, same as SSR recovery). */
export async function renderClientErrorOutlet(
  manifest: RouteManifest,
  match: RouteMatch | null,
  err: unknown
): Promise<JSX.Element | null> {
  const renderErr = toRenderError(err)
  let tree = match != null ? await loadErrorRouteTree(match) : null
  if (!tree) tree = await loadRootErrorRouteTree(manifest)
  if (!tree) return null
  return buildRoutedSubtree(tree.layoutModules, tree.routeModule, {
    error: renderErr,
  })
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

export type BuildRoutedSubtreeOptions = {
  /** Client-only: route render throws invoke this instead of bubbling to Cypress. */
  onLeafRenderError?: (err: unknown) => void
}

/** Layout stack + page only (no RouterProvider). Matches SSR/SSG body HTML. */
export function buildRoutedSubtree(
  layoutModules: Array<RouteModule | null>,
  routeModule: RouteModule,
  leafProps?: LeafRouteProps,
  options?: BuildRoutedSubtreeOptions
) {
  let leaf = createElement(
    asComponent(routeModule),
    (leafProps ?? {}) as Record<string, unknown>
  )
  let app = leaf
  if (options?.onLeafRenderError) {
    app = createElement(ErrorBoundary, {
      children: leaf,
      onError: options.onLeafRenderError,
    })
  }
  for (const module of layoutModules.slice().reverse()) {
    if (!module) continue
    app = createElement(asComponent(module), { children: app })
  }
  return app
}

function asComponent(module: RouteModule): Kiru.Component<any> {
  return typeof module === "function" ? module : module.default
}

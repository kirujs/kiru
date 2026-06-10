import { createElement, Fragment } from "../element.js"
import {
  InterceptorModuleShell,
  InterceptorOwnerProvider,
} from "./interceptorOwner.js"
import { resolveNotFoundScopes } from "./manifest.js"
import type { KiruLoader, PageProps } from "./loaders.js"
import type {
  ErrorModule,
  ErrorPageProps,
  InterceptorOwner,
  LayoutModule,
  NotFoundModule,
  PageModule,
  RoutableModule,
  RouteManifest,
  RouteMatch,
} from "./types.js"
import { toRenderError } from "./types.js"
import type { InterceptorHandle } from "./routePaths.js"

export type LeafRouteProps =
  | ErrorPageProps
  | PageProps<KiruLoader<unknown>>
  | Record<string, never>

export type LeafRouteModule = PageModule | ErrorModule | NotFoundModule

interface RouteTreeLoadResult {
  layoutModules: Array<LayoutModule | null>
  routeModule: LeafRouteModule
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
  return buildRoutedSubtree(
    tree.layoutModules,
    tree.routeModule,
    { error: renderErr },
    { match }
  )
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
  const layoutModules: Array<LayoutModule | null> = rootLayout
    ? [rootLayout]
    : []
  return { layoutModules, routeModule }
}

function wrapComponentWithRenderErrorCapture(
  component: Kiru.Component<any>,
  onError: (err: unknown) => void
): Kiru.Component<any> {
  return function Wrapped(props: Record<string, unknown>) {
    try {
      const result = component(props)
      if (typeof result !== "function") return result
      const render = result as (props: Record<string, unknown>) => JSX.Element
      return (innerProps: Record<string, unknown>) => {
        try {
          return render(innerProps)
        } catch (err) {
          onError(err)
          return null
        }
      }
    } catch (err) {
      onError(err)
      return null
    }
  }
}

export type BuildRoutedSubtreeOptions = {
  /** Client-only: route render throws invoke this instead of bubbling to Cypress. */
  onLeafRenderError?: (err: unknown) => void
  /** When set, co-exported `interceptors` are wired with owner-aware Outlets. */
  match?: RouteMatch | null
}

function readInterceptorsFromModule(
  module: RoutableModule<Kiru.Component<any>>
): Record<string, InterceptorHandle> | null {
  if (typeof module === "function") return null
  return module.interceptors ?? null
}

function wrapWithInterceptorOwner(
  module: RoutableModule<Kiru.Component<any>>,
  owner: InterceptorOwner,
  inner: Kiru.Element
): Kiru.Element {
  const handles = readInterceptorsFromModule(module)
  let content = inner
  if (handles) {
    const slotNames = Object.keys(handles)
    content = createElement(InterceptorModuleShell, {
      handles,
      slotNames,
      children: content,
    })
  }
  return createElement(InterceptorOwnerProvider, {
    owner,
    handles,
    slotNames: handles ? Object.keys(handles) : undefined,
    children: content,
  })
}

/** Stable key for a layout stack — used to persist layouts across leaf navigations. */
export function computeLayoutStackKey(
  layoutModules: Array<LayoutModule | null>,
  match: RouteMatch | null
): string {
  const scopes = match?.route.scopes ?? []
  return layoutModules
    .map((module, i) =>
      module == null ? "" : (scopes[i]?.id ?? `layout:${i}`)
    )
    .join("|")
}

/** Leaf route element only (no layout wrappers). */
export function buildRoutedLeaf(
  routeModule: LeafRouteModule,
  leafProps?: LeafRouteProps,
  options?: Pick<BuildRoutedSubtreeOptions, "onLeafRenderError" | "match">
): JSX.Element {
  let leaf = asComponent(routeModule)
  if (options?.onLeafRenderError) {
    leaf = wrapComponentWithRenderErrorCapture(leaf, options.onLeafRenderError)
  }
  let app = createElement(leaf, (leafProps ?? {}) as Record<string, unknown>)
  const match = options?.match ?? null
  if (match) {
    app = wrapWithInterceptorOwner(
      routeModule,
      { kind: "route", routeId: match.route.id },
      app
    )
  }
  return app
}

/** Wrap an existing child inside the layout stack (layouts persist; child swaps). */
export function composeLayoutWithChild(
  layoutModules: Array<LayoutModule | null>,
  child: JSX.Element | null,
  options?: BuildRoutedSubtreeOptions & { leafKey?: string }
): JSX.Element | null {
  if (child == null) return null
  let app = child
  if (options?.leafKey) {
    app = createElement(Fragment, { key: options.leafKey }, child)
  }
  const match = options?.match ?? null
  const scopes = match?.route.scopes ?? []
  for (let i = layoutModules.length - 1; i >= 0; i--) {
    const module = layoutModules[i]
    if (!module) continue
    const scope = scopes[i]
    app = createElement(asComponent(module), {
      key: scope?.id ?? `layout:${i}`,
      children: app,
    })
    if (match && scope) {
      app = wrapWithInterceptorOwner(
        module,
        { kind: "scope", scopeId: scope.id },
        app
      )
    }
  }
  return app
}

/** Layout stack + page only (no RouterProvider). Matches SSR/SSG body HTML. */
export function buildRoutedSubtree(
  layoutModules: Array<LayoutModule | null>,
  routeModule: LeafRouteModule,
  leafProps?: LeafRouteProps,
  options?: BuildRoutedSubtreeOptions
) {
  const leaf = buildRoutedLeaf(routeModule, leafProps, options)
  const match = options?.match ?? null
  const leafKey = match ? `${match.route.id}:${match.pathname}` : undefined
  return composeLayoutWithChild(layoutModules, leaf, { ...options, leafKey })
}

function asComponent(
  module: RoutableModule<Kiru.Component<any>>
): Kiru.Component<any> {
  return typeof module === "function" ? module : module.default
}

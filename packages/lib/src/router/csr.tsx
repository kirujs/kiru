import * as kiru from "../index.js"
import { createContext, useContext } from "../context.js"
import { signal } from "../signals/base.js"
import { resource } from "../resource.js"
import { Derive } from "../components/derive.js"
import { matchRoute } from "./manifest.js"
import { createElement } from "../element.js"
import type {
  RouteManifest,
  RouteMatch,
  RouteModule,
  RouteTreeDefinition,
} from "./types.js"
import { compileRouteTree } from "./manifest.js"

type LoadedView = {
  layouts: Array<RouteModule | null>
  routeModule: RouteModule
  match: RouteMatch
}

function asComponent(module: RouteModule): Kiru.FC<any> {
  return typeof module === "function" ? module : module.default
}

function joinPath(base: string, path: string): string {
  if (path.startsWith("/")) return path
  if (base.endsWith("/")) return `${base}${path}`
  return `${base}/${path}`
}

export type RouterNavigationMode = "history" | "static"

export interface Router {
  manifest: RouteManifest
  path: Kiru.Signal<string>
  match: Kiru.Signal<RouteMatch | null>
  navigate: (to: string, replace?: boolean) => void
  resolveHref: (to: string) => string
  /** `"history"` = SPA navigation; `"static"` = prerender/SSR (native &lt;a&gt; only). */
  navigationMode: RouterNavigationMode
}

export function createRouter({
  routes,
  history = window.history,
  location = window.location,
}: {
  routes: RouteTreeDefinition | RouteManifest
  history?: History
  location?: Location
}): Router {
  const manifest = "routes" in routes ? routes : compileRouteTree(routes)
  const path = signal(location.pathname)
  const match = signal(matchRoute(manifest, path.value))

  const syncFromLocation = () => {
    path.value = location.pathname
    match.value = matchRoute(manifest, path.value)
  }

  if (typeof window !== "undefined") {
    window.addEventListener("popstate", syncFromLocation)
  }

  return {
    manifest,
    path,
    match,
    navigationMode: "history",
    navigate(to, replace = false) {
      if (replace) history.replaceState(null, "", to)
      else history.pushState(null, "", to)
      syncFromLocation()
    },
    resolveHref(to) {
      return joinPath(path.value, to)
    },
  }
}

export function createStaticRouter({
  manifest,
  pathname,
}: {
  manifest: RouteManifest
  pathname: string
}): Router {
  const path = signal(pathname)
  const match = signal(matchRoute(manifest, pathname))

  return {
    manifest,
    path,
    match,
    navigationMode: "static",
    navigate() {},
    resolveHref(to) {
      return joinPath(path.value, to)
    },
  }
}

const RouterContext = createContext<Router | null>(null)

export function RouterProvider({
  router,
  children,
}: {
  router: Router
  children?: JSX.Children
}) {
  return <RouterContext value={router}>{children}</RouterContext>
}

export function useRouter(): Router {
  const router = useContext(RouterContext)
  if (!router) throw new Error("useRouter must be used inside RouterProvider")
  return router
}

export function Link({
  to,
  replace,
  prefetch = "none",
  children,
  ...rest
}: {
  to: string
  replace?: boolean
  prefetch?: "hover" | "visible" | "none"
  children: JSX.Children
} & JSX.IntrinsicElements["a"]) {
  const router = useRouter()

  const triggerPrefetch = () => {
    if (router.navigationMode !== "history" || prefetch === "none") return
    const href = router.resolveHref(to)
    const match = matchRoute(router.manifest, href)
    if (!match) return
    for (const scope of match.route.scopes) scope.layout?.()
    void match.route.component()
  }

  const href = router.resolveHref(to)
  const useSpaNav = router.navigationMode === "history"

  return (
    <a
      {...rest}
      href={href}
      onmouseenter={() => {
        if (prefetch === "hover") triggerPrefetch()
      }}
      {...(useSpaNav
        ? {
            onclick: (event: MouseEvent) => {
              event.preventDefault()
              router.navigate(to, replace)
            },
          }
        : {})}
    >
      {children}
    </a>
  )
}

export function RouterView({ router }: { router?: Router }) {
  const activeRouter = router ?? useRouter()
  const view = resource({ m: activeRouter.match }, ({ m }) => {
    if (!m) return Promise.resolve(null)
    return Promise.all([
      Promise.all(m.route.scopes.map((scope) => scope.layout?.() ?? null)),
      m.route.component(),
    ]).then(
      ([layouts, routeModule]) =>
        ({
          layouts,
          routeModule,
          match: m,
        }) satisfies LoadedView
    )
  })

  return (
    <Derive from={view} fallback={<div>Loading route...</div>}>
      {(loaded) => {
        if (!loaded) return <div>Not found</div>
        let tree = createElement(
          asComponent(loaded.routeModule),
          loaded.match.params
        )
        for (const layoutMod of loaded.layouts.slice().reverse()) {
          if (!layoutMod) continue
          tree = createElement(asComponent(layoutMod), { children: tree })
        }
        return tree
      }}
    </Derive>
  )
}

import { Signal } from "../signals/base.js"
import { ComputedSignal } from "../signals/computed.js"
import { flushSync } from "../scheduler.js"
import { __DEV__ } from "../env.js"
import { createElement } from "../element.js"
import { type FileRouterContextType } from "./context.js"
import { FileRouterDataLoadError } from "./errors.js"
import { fileRouterInstance } from "./globals.js"
import type {
  ErrorPageProps,
  FileRouterConfig,
  PageConfig,
  PageProps,
  RouteQuery,
  RouterState,
} from "./types.js"
import type {
  DefaultComponentModule,
  PageModule,
  ViteImportMap,
} from "./types.internal.js"

interface FormattedViteImportMap {
  [key: string]: {
    load: () => Promise<DefaultComponentModule>
    specificity: number
    segments: string[]
    filePath?: string
  }
}

export class FileRouterController {
  private enableTransitions: boolean
  private pages: FormattedViteImportMap
  private layouts: FormattedViteImportMap
  private abortController: AbortController
  private currentPage: Signal<{
    component: Kiru.FC<any>
    config?: PageConfig
    route: string
  } | null>
  private currentPageProps: Signal<PageProps<PageConfig>>
  private currentLayouts: Signal<Kiru.FC[]>
  private state: Signal<RouterState>
  private contextValue: Signal<FileRouterContextType>
  private cleanups: (() => void)[] = []
  private filePathToPageRoute?: Map<
    string,
    { route: string; config: PageConfig }
  >
  private pageRouteToConfig?: Map<string, PageConfig>
  private currentRoute: string | null

  constructor(config: FileRouterConfig) {
    fileRouterInstance.current = this
    this.pages = {}
    this.layouts = {}
    this.abortController = new AbortController()
    this.currentPage = new Signal(null)
    this.currentPageProps = new Signal({})
    this.currentLayouts = new Signal([])
    this.state = new Signal<RouterState>({
      path: window.location.pathname,
      params: {},
      query: {},
      signal: this.abortController.signal,
    })
    this.contextValue = new ComputedSignal<FileRouterContextType>(() => ({
      state: this.state.value,
      navigate: this.navigate.bind(this),
      setQuery: this.setQuery.bind(this),
      reload: (options?: { transition?: boolean }) =>
        this.loadRoute(void 0, void 0, options?.transition),
    }))
    if (__DEV__) {
      this.filePathToPageRoute = new Map()
      this.pageRouteToConfig = new Map()
    }
    this.currentRoute = null

    const { pages, layouts, dir = "/pages", baseUrl = "/", transition } = config
    this.enableTransitions = !!transition
    const [normalizedDir, normalizedBaseUrl] = [
      normalizePrefixPath(dir),
      normalizePrefixPath(baseUrl),
    ]
    this.pages = formatViteImportMap(
      pages as ViteImportMap,
      normalizedDir,
      normalizedBaseUrl
    )
    if (__DEV__) {
      validateRoutes(this.pages)
    }
    this.layouts = formatViteImportMap(
      layouts as ViteImportMap,
      normalizedDir,
      normalizedBaseUrl
    )

    this.loadRoute()

    const handlePopState = () => this.loadRoute()
    window.addEventListener("popstate", handlePopState)
    this.cleanups.push(() =>
      window.removeEventListener("popstate", handlePopState)
    )
  }

  public onPageConfigDefined<T extends PageConfig>(fp: string, config: T) {
    const existing = this.filePathToPageRoute?.get(fp)
    if (existing === undefined) {
      const route = this.currentRoute
      if (!route) return
      this.filePathToPageRoute?.set(fp, { route, config })
      return
    }
    const curPage = this.currentPage.value
    if (curPage?.route === existing.route && config.loader) {
      const p = this.currentPageProps.value
      let transition = this.enableTransitions
      if (config.loader.transition !== undefined) {
        transition = config.loader.transition
      }
      const props = {
        ...p,
        loading: true,
        data: null,
        error: null,
      }
      handleStateTransition(this.state.value.signal, transition, () => {
        this.currentPageProps.value = props
      })

      this.loadRouteData(config.loader, props, this.state.value, transition)
    }

    this.pageRouteToConfig?.set(existing.route, config)
  }

  public getContextValue() {
    return this.contextValue.value
  }

  public getChildren() {
    const page = this.currentPage.value,
      props = this.currentPageProps.value,
      layouts = this.currentLayouts.value

    if (page) {
      // Wrap component with layouts (outermost first)
      return layouts.reduceRight(
        (children, Layout) => createElement(Layout, { children }),
        createElement(page.component, props)
      )
    }

    return null
  }

  public dispose() {
    this.cleanups.forEach((cleanup) => cleanup())
  }

  private matchRoute(pathSegments: string[]) {
    const matches: Array<{
      route: string
      pageEntry: FormattedViteImportMap[string]
      params: Record<string, string>
      routeSegments: string[]
    }> = []

    // Find all matching routes
    outer: for (const [route, pageEntry] of Object.entries(this.pages)) {
      const routeSegments = pageEntry.segments
      const pathMatchingSegments = routeSegments.filter(
        (seg) => !seg.startsWith("(") && !seg.endsWith(")")
      )

      const params: Record<string, string> = {}
      let hasCatchall = false

      // Check if route matches
      for (
        let i = 0;
        i < pathMatchingSegments.length && i < pathSegments.length;
        i++
      ) {
        const routeSeg = pathMatchingSegments[i]

        if (routeSeg.startsWith(":")) {
          const key = routeSeg.slice(1)

          if (routeSeg.endsWith("*")) {
            // Catchall route - matches remaining segments
            hasCatchall = true
            const catchallKey = key.slice(0, -1) // Remove the *
            params[catchallKey] = pathSegments.slice(i).join("/")
            break
          } else {
            // Regular dynamic segment
            if (i >= pathSegments.length) {
              continue outer
            }
            params[key] = pathSegments[i]
          }
        } else {
          // Static segment
          if (routeSeg !== pathSegments[i]) {
            continue outer
          }
        }
      }

      // For non-catchall routes, ensure exact length match
      if (!hasCatchall && pathMatchingSegments.length !== pathSegments.length) {
        continue
      }

      matches.push({
        route,
        pageEntry,
        params,
        routeSegments,
      })
    }

    // Sort by specificity (highest first) and return the best match
    if (matches.length === 0) {
      return null
    }

    matches.sort((a, b) => b.pageEntry.specificity - a.pageEntry.specificity)
    const bestMatch = matches[0]

    return bestMatch
  }

  private async loadRoute(
    path: string = window.location.pathname,
    props: PageProps<PageConfig> = {},
    enableTransition = this.enableTransitions
  ): Promise<void> {
    this.abortController?.abort()
    const signal = (this.abortController = new AbortController()).signal

    try {
      const pathSegments = path.split("/").filter(Boolean)
      const routeMatch = this.matchRoute(pathSegments)

      if (!routeMatch) {
        const _404 = this.matchRoute(["404"])
        if (!_404) {
          if (__DEV__) {
            console.error(
              `[kiru/router]: No 404 route defined (path: ${path}). 
See https://kirujs.dev/docs/api/file-router#404 for more information.`
            )
          }
          return
        }
        const errorProps = {
          source: { path },
        } satisfies ErrorPageProps

        return this.navigate("/404", { replace: true, props: errorProps })
      }

      const { route, pageEntry, params, routeSegments } = routeMatch

      this.currentRoute = route
      const pagePromise = pageEntry.load()

      const layoutPromises = ["/", ...routeSegments].reduce((acc, _, i) => {
        const layoutPath = "/" + routeSegments.slice(0, i).join("/")
        const layout = this.layouts[layoutPath]

        if (!layout) {
          return acc
        }

        return [...acc, layout.load()]
      }, [] as Promise<DefaultComponentModule>[])

      const query = parseQuery(window.location.search)
      const [page, ...layouts] = await Promise.all([
        pagePromise,
        ...layoutPromises,
      ])

      this.currentRoute = null
      if (signal.aborted) return

      if (typeof page.default !== "function") {
        throw new Error(
          "[kiru/router]: Route component must be a default exported function"
        )
      }

      const routerState: RouterState = {
        path,
        params,
        query,
        signal,
      }

      let config = (page as unknown as PageModule).config
      if (__DEV__) {
        if (this.pageRouteToConfig?.has(route)) {
          config = this.pageRouteToConfig.get(route)
        }
      }

      if (config?.loader) {
        props = { ...props, loading: true, data: null, error: null }
        this.loadRouteData(config.loader, props, routerState, enableTransition)
      }

      this.state.value = routerState
      handleStateTransition(signal, enableTransition, () => {
        this.currentPage.value = {
          component: page.default,
          config,
          route: "/" + routeSegments.join("/"),
        }
        this.currentPageProps.value = props
        this.currentLayouts.value = layouts
          .filter((m) => typeof m.default === "function")
          .map((m) => m.default)
      })
    } catch (error) {
      console.error("[kiru/router]: Failed to load route component:", error)
      this.currentPage.value = null
    }
  }

  private async loadRouteData(
    loader: NonNullable<PageConfig["loader"]>,
    props: PageProps<PageConfig>,
    routerState: RouterState,
    enableTransition = this.enableTransitions
  ) {
    loader
      .load(routerState)
      .then(
        (data) => ({ data, error: null }),
        (error) => ({
          data: null,
          error: new FileRouterDataLoadError(error),
        })
      )
      .then(({ data, error }) => {
        if (routerState.signal.aborted) return

        let transition = enableTransition
        if (loader.transition !== undefined) {
          transition = loader.transition
        }

        handleStateTransition(routerState.signal, transition, () => {
          this.currentPageProps.value = {
            ...props,
            loading: false,
            data,
            error,
          }
        })
      })
  }

  private async navigate(
    path: string,
    options?: {
      replace?: boolean
      transition?: boolean
      props?: Record<string, unknown>
    }
  ) {
    const f = options?.replace ? "replaceState" : "pushState"
    window.history[f]({}, "", path)
    window.dispatchEvent(new PopStateEvent("popstate", { state: {} }))
    return this.loadRoute(path, options?.props, options?.transition)
  }

  private setQuery(query: RouteQuery) {
    const queryString = buildQueryString(query)
    const newUrl = `${this.state.value.path}${
      queryString ? `?${queryString}` : ""
    }`
    window.history.pushState(null, "", newUrl)
    this.state.value = { ...this.state.value, query }
  }
}

function parseQuery(
  search: string
): Record<string, string | string[] | undefined> {
  const params = new URLSearchParams(search)
  const query: Record<string, string | string[] | undefined> = {}

  for (const [key, value] of params.entries()) {
    if (query[key]) {
      // Convert to array if multiple values
      if (Array.isArray(query[key])) {
        ;(query[key] as string[]).push(value)
      } else {
        query[key] = [query[key] as string, value]
      }
    } else {
      query[key] = value
    }
  }

  return query
}

function buildQueryString(
  query: Record<string, string | string[] | undefined>
): string {
  const params = new URLSearchParams()

  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) {
      if (Array.isArray(value)) {
        value.forEach((v) => params.append(key, v))
      } else {
        params.set(key, value)
      }
    }
  }

  return params.toString()
}

function formatViteImportMap(
  map: ViteImportMap,
  dir: string,
  baseUrl: string
): FormattedViteImportMap {
  return Object.keys(map).reduce<FormattedViteImportMap>((acc, key) => {
    const dirIndex = key.indexOf(dir)
    if (dirIndex === -1) {
      return acc
    }

    let specificity = 0
    let k = key.slice(dirIndex + dir.length)
    while (k.startsWith("/")) {
      k = k.slice(1)
    }
    const segments: string[] = []
    const parts = k.split("/").slice(0, -1)

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      if (part.startsWith("[...") && part.endsWith("]")) {
        if (i !== parts.length - 1) {
          throw new Error(
            `[kiru/router]: Catchall must be the folder name. Got "${key}"`
          )
        }
        segments.push(`:${part.slice(4, -1)}*`)
        specificity += 1
        break
      }
      if (part.startsWith("[") && part.endsWith("]")) {
        segments.push(`:${part.slice(1, -1)}`)
        specificity += 10
        continue
      }
      specificity += 100
      segments.push(part)
    }

    const value: FormattedViteImportMap[string] = {
      load: map[key],
      specificity,
      segments,
    }

    if (__DEV__) {
      value.filePath = key
    }

    return {
      ...acc,
      [baseUrl + segments.join("/")]: value,
    }
  }, {})
}

function normalizePrefixPath(path: string) {
  while (path.startsWith(".")) {
    path = path.slice(1)
  }
  path = `/${path}/`
  while (path.startsWith("//")) {
    path = path.slice(1)
  }
  while (path.endsWith("//")) {
    path = path.slice(0, -1)
  }
  return path
}

function handleStateTransition(
  signal: AbortSignal,
  enableTransition: boolean,
  callback: () => void
) {
  if (!enableTransition || typeof document.startViewTransition !== "function") {
    return callback()
  }
  const vt = document.startViewTransition(() => {
    callback()
    flushSync()
  })

  signal.addEventListener("abort", () => vt.skipTransition())
}

function validateRoutes(pageMap: FormattedViteImportMap) {
  type Entry = FormattedViteImportMap[string]
  const routeConflicts: [Entry, Entry][] = []
  const routes = Object.keys(pageMap)
  for (let i = 0; i < routes.length; i++) {
    for (let j = i + 1; j < routes.length; j++) {
      const route1 = routes[i]
      const route2 = routes[j]

      if (routesConflict(route1, route2)) {
        routeConflicts.push([pageMap[route1], pageMap[route2]])
      }
    }
  }

  if (routeConflicts.length > 0) {
    let warning = "[kiru/router]: Route conflicts detected:\n"
    warning += routeConflicts.map(([route1, route2]) => {
      return `  - "${route1.filePath}" conflicts with "${route2.filePath}"\n`
    })
    warning += "Routes are ordered by specificity (higher specificity wins)"
    console.warn(warning)
  }
}

function routesConflict(route1: string, route2: string): boolean {
  const segments1 = route1.split("/").filter(Boolean)
  const segments2 = route2.split("/").filter(Boolean)

  // Filter out route groups for comparison
  const pathSegments1 = segments1.filter(
    (seg) => !seg.startsWith("(") && !seg.endsWith(")")
  )
  const pathSegments2 = segments2.filter(
    (seg) => !seg.startsWith("(") && !seg.endsWith(")")
  )

  // Routes conflict if they have the same path structure
  if (pathSegments1.length !== pathSegments2.length) {
    return false
  }

  for (let i = 0; i < pathSegments1.length; i++) {
    const seg1 = pathSegments1[i]
    const seg2 = pathSegments2[i]

    // If both are static segments, they must match exactly
    if (!seg1.startsWith(":") && !seg2.startsWith(":")) {
      if (seg1 !== seg2) {
        return false
      }
    }
    // If one is static and one is dynamic, they conflict
    else if (
      (seg1.startsWith(":") && !seg2.startsWith(":")) ||
      (!seg1.startsWith(":") && seg2.startsWith(":"))
    ) {
      return false
    }
    // If both are dynamic, they conflict
    else if (seg1.startsWith(":") && seg2.startsWith(":")) {
      // Both are dynamic, check if they're the same type
      const isCatchall1 = seg1.endsWith("*")
      const isCatchall2 = seg2.endsWith("*")
      if (isCatchall1 !== isCatchall2) {
        return false
      }
    }
  }

  return true
}

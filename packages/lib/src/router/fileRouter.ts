import { Signal, computed, flushSync } from "../index.js"
import { __DEV__ } from "../env.js"
import { createElement } from "../element.js"
import { useState, useEffect } from "../hooks/index.js"
import { RouterContext, type FileRouterContextType } from "./context.js"
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

export class FileRouterController {
  private enableTransitions: boolean
  private pages: ViteImportMap
  private layouts: ViteImportMap
  private abortController: AbortController
  private currentPage: Signal<{
    component: Kiru.FC<any>
    config?: PageConfig
    route: string
  } | null>
  private currentPageProps: Signal<PageProps<PageConfig>>
  private currentLayouts: Signal<Kiru.FC[]>
  private loading: Signal<boolean>
  private state: Signal<RouterState>
  private contextValue: Signal<FileRouterContextType>
  private cleanups: (() => void)[] = []
  private filePathToPageRoute: Map<
    string,
    {
      route: string
      config: PageConfig
    }
  >
  private pageRouteToConfig: Map<string, PageConfig>
  private currentRoute: string | null

  constructor(props: FileRouterProps) {
    fileRouterInstance.current = this
    this.pages = {}
    this.layouts = {}
    this.abortController = new AbortController()
    this.currentPage = new Signal(null)
    this.currentPageProps = new Signal({})
    this.currentLayouts = new Signal([])
    this.loading = new Signal(true)
    this.state = new Signal<RouterState>({
      path: window.location.pathname,
      params: {},
      query: {},
      signal: this.abortController.signal,
    })
    this.contextValue = computed<FileRouterContextType>(() => ({
      state: this.state.value,
      navigate: this.navigate.bind(this),
      setQuery: this.setQuery.bind(this),
      reload: (options?: { transition?: boolean }) =>
        this.loadRoute(void 0, void 0, options?.transition),
    }))
    this.filePathToPageRoute = new Map()
    this.pageRouteToConfig = new Map()
    this.currentRoute = null

    const {
      pages,
      layouts,
      dir = "/pages",
      baseUrl = "/",
      transition,
    } = props.config
    this.enableTransitions = !!transition
    const [normalizedDir, normalizedBaseUrl] = [
      normalizePrefixPath(dir),
      normalizePrefixPath(baseUrl),
    ]
    debugger
    this.pages = formatViteImportMap(
      pages as ViteImportMap,
      normalizedDir,
      normalizedBaseUrl
    )
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
    const existing = this.filePathToPageRoute.get(fp)
    if (existing === undefined) {
      const route = this.currentRoute
      if (!route) return
      this.filePathToPageRoute.set(fp, { route, config })
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

    this.pageRouteToConfig.set(existing.route, config)
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
    outer: for (const [route, pageModuleLoader] of Object.entries(this.pages)) {
      const routeSegments = route.split("/").filter(Boolean)

      const pathMatchingSegments = routeSegments.filter(
        (seg) => !seg.startsWith("(") && !seg.endsWith(")")
      )

      if (pathMatchingSegments.length !== pathSegments.length) {
        continue
      }
      const params: Record<string, string> = {}

      for (let i = 0; i < pathMatchingSegments.length; i++) {
        const routeSeg = pathMatchingSegments[i]
        if (routeSeg.startsWith(":")) {
          const key = routeSeg.slice(1)
          params[key] = pathSegments[i]
          continue
        }
        if (routeSeg !== pathSegments[i]) {
          continue outer
        }
      }

      return { route, pageModuleLoader, params, routeSegments }
    }

    return null
  }

  private async loadRoute(
    path: string = window.location.pathname,
    props: PageProps<PageConfig> = {},
    enableTransition = this.enableTransitions
  ): Promise<void> {
    this.loading.value = true
    this.abortController?.abort()

    const query = parseQuery(window.location.search)
    const controller = (this.abortController = new AbortController())
    const signal = controller.signal

    try {
      const pathSegments = path.split("/").filter(Boolean)
      const routeMatch = this.matchRoute(pathSegments)

      if (!routeMatch) {
        const _404 = this.matchRoute(["404"])
        if (!_404) {
          if (__DEV__) {
            console.error(
              `No 404 route defined (path: ${path}). See https://kirujs.dev/404 for more information.`
            )
          }
          return
        }
        const errorProps = {
          source: { path },
        } satisfies ErrorPageProps

        return this.navigate("/404", { replace: true, props: errorProps })
      }

      const { route, pageModuleLoader, params, routeSegments } = routeMatch

      this.currentRoute = route
      const pagePromise = pageModuleLoader()

      const layoutPromises = ["/", ...routeSegments].reduce((acc, _, i) => {
        const layoutPath = "/" + routeSegments.slice(0, i).join("/")
        const layoutLoad = this.layouts[layoutPath]

        if (!layoutLoad) {
          return acc
        }

        return [...acc, layoutLoad()]
      }, [] as Promise<DefaultComponentModule>[])

      const [page, ...layouts] = await Promise.all([
        pagePromise,
        ...layoutPromises,
      ])

      this.currentRoute = null
      if (controller.signal.aborted) return

      if (typeof page.default !== "function") {
        throw new Error("Route component must be a default exported function")
      }

      const routerState: RouterState = {
        path,
        params,
        query,
        signal,
      }

      let config = (page as unknown as PageModule).config
      if (this.pageRouteToConfig.has(route)) {
        config = this.pageRouteToConfig.get(route)
      }

      if (config?.loader) {
        props = { ...props, loading: true, data: null, error: null }
        this.loadRouteData(config.loader, props, routerState, enableTransition)
      }

      handleStateTransition(signal, enableTransition, () => {
        this.currentPage.value = {
          component: page.default,
          config,
          route: "/" + routeSegments.join("/"),
        }
        this.state.value = routerState
        this.currentPageProps.value = props
        this.currentLayouts.value = layouts
          .filter((m) => typeof m.default === "function")
          .map((m) => m.default)
      })
    } catch (error) {
      console.error("Failed to load route component:", error)
      this.currentPage.value = null
    } finally {
      this.loading.value = false
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

export interface FileRouterProps {
  /**
   * The router configuration
   * @example
   * ```ts
   *<FileRouter
       config={{
         dir: "/fbr-app", // optional, defaults to "/pages"
         baseUrl: "/app", // optional, defaults to "/"
         pages: import.meta.glob("/∗∗/index.tsx"),
         layouts: import.meta.glob("/∗∗/layout.tsx"),
         transition: true
       }}
  />
   * ```
   */
  config: FileRouterConfig
}

export function FileRouter(props: FileRouterProps): JSX.Element {
  const [controller] = useState(() => new FileRouterController(props))
  useEffect(() => () => controller.dispose(), [controller])

  return createElement(
    RouterContext.Provider,
    { value: controller.getContextValue() },
    controller.getChildren()
  )
}

// Utility functions

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
): ViteImportMap {
  return Object.keys(map).reduce((acc, key) => {
    let k = key
    const dirIndex = k.indexOf(dir)
    if (dirIndex === -1) {
      return acc
    }

    k = k.slice(dirIndex + dir.length)
    while (k.startsWith("/")) {
      k = k.slice(1)
    }
    k = k.split("/").slice(0, -1).join("/") // remove filename
    k = k.replace(/\[([^\]]+)\]/g, ":$1") // replace [param] with :param

    return {
      ...acc,
      [baseUrl + k]: map[key],
    }
  }, {})
}

function normalizePrefixPath(path: string) {
  while (path.startsWith(".")) {
    path = path.slice(1)
  }
  while (path.endsWith("/")) {
    path = path.slice(0, -1)
  }
  if (!path.startsWith("/")) {
    path = "/" + path
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

import { signal, Signal } from "../signals/base.js"
import { effect } from "../signals/effect.js"
import { __DEV__ } from "../env.js"
import { nextIdle } from "../scheduler.js"
import { ReloadOptions, type FileRouterContextType } from "./context.js"
import { FileRouterDataLoadError } from "./errors.js"
import { fileRouterInstance, fileRouterRoute, routerCache } from "./globals.js"
import type {
  FileRouterConfig,
  PageConfig,
  PageDataLoaderConfig,
  PageDataLoaderContext,
  PageProps,
  RouteParams,
  RouteQuery,
  RouterState,
} from "./types.js"
import type {
  CurrentPage,
  DevtoolsInterface,
  FormattedViteImportMap,
  PageModule,
  ViteImportMap,
} from "./types.internal.js"
import {
  formatViteImportMap,
  matchLayouts,
  matchRoute,
  match404Route,
  normalizePrefixPath,
  parseQuery,
  wrapWithLayouts,
} from "./utils/index.js"
import { RouterCache, type CacheKey } from "./cache.js"
import { scrollStack } from "./scrollStack.js"
import { ViewTransitions } from "../viewTransitions.js"

interface PageConfigWithLoader<T = unknown> extends PageConfig {
  loader: PageDataLoaderConfig<T>
}

export class FileRouterController {
  public contextValue: FileRouterContextType
  public devtools?: DevtoolsInterface
  public dev_onPageConfigDefined?: <T extends PageConfig<any>>(
    fp: string,
    config: T
  ) => void
  private abortController: AbortController
  private currentPage: Signal<CurrentPage | null>
  private currentPageProps: Signal<Record<string, unknown>>
  private currentLayouts: Signal<Kiru.FC[]>
  private enableTransitions: boolean
  private filePathToPageRoute?: Map<
    string,
    { route: string; config: PageConfig }
  >
  private historyIndex: number
  private layouts: FormattedViteImportMap
  private pages: FormattedViteImportMap<PageModule>
  private pageRouteToConfig?: Map<string, PageConfig>
  private state: RouterState
  private baseUrl = "/"

  constructor() {
    routerCache.current ??= new RouterCache()
    this.abortController = new AbortController()
    this.currentPage = signal(null)
    this.currentPageProps = signal({})
    this.currentLayouts = signal([])
    this.enableTransitions = false
    this.historyIndex = 0
    this.layouts = {}
    this.pages = {}
    this.state = {
      pathname: signal(window.location.pathname),
      hash: signal(window.location.hash),
      params: signal<RouteParams>({}),
      query: signal<RouteQuery>({}),
      signal: this.abortController.signal,
    }
    this.contextValue = this.createContextValue()
    if (__DEV__) {
      this.filePathToPageRoute = new Map()
      this.pageRouteToConfig = new Map()
      this.dev_onPageConfigDefined = (fp, config) => {
        const existing = this.filePathToPageRoute?.get(fp)
        if (existing === undefined) {
          const route = fileRouterRoute.current
          if (!route) return
          this.filePathToPageRoute?.set(fp, { route, config })
          return
        }
        const curPage = this.currentPage.value
        const loader = config.loader
        if (curPage?.route === existing.route && loader) {
          const p = this.currentPageProps.value
          const transition =
            (loader.mode !== "static" && loader.transition) ??
            this.enableTransitions

          // Check cache first if caching is enabled
          let cachedData = null
          if (loader.mode !== "static" && loader.cache) {
            const { pathname, params, query } = this.state
            const cacheKey: CacheKey = {
              path: pathname.peek(),
              params: params.peek(),
              query: query.peek(),
            }
            cachedData = routerCache.current!.get(cacheKey, loader.cache)
          }

          if (cachedData !== null) {
            // Use cached data immediately - no loading state needed
            const props = {
              ...p,
              data: cachedData.value,
              error: null,
              loading: false,
            }
            handleStateTransition(this.state.signal, transition, () => {
              this.currentPageProps.value = props
            })
          } else {
            // No cached data - show loading state and load data
            const props = {
              ...p,
              loading: true,
              data: null,
              error: null,
            }
            handleStateTransition(this.state.signal, transition, () => {
              this.currentPageProps.value = props
            })

            const { pathname, hash, params, query, signal } = this.state

            this.loadRouteData(
              config as PageConfigWithLoader,
              props,
              {
                pathname: pathname.peek(),
                hash: hash.peek(),
                params: params.peek(),
                query: query.peek(),
                signal,
              },
              transition
            )
          }
        }

        this.pageRouteToConfig?.set(existing.route, config)
      }
      this.devtools = {
        getPages: () => this.pages,
        invalidate: async (...paths: string[]) => {
          if (this.invalidate(...paths)) {
            return this.loadRoute()
          }
        },
        navigate: this.navigate.bind(this),
        reload: () => {
          this.invalidate(this.state.pathname.peek())
          return this.loadRoute()
        },
        subscribe: (callback) => {
          const e = effect([this.currentPage, this.currentPageProps], callback)
          return () => e.stop()
        },
      }
    }
  }

  public init(config: FileRouterConfig) {
    const {
      pages,
      layouts,
      dir = "/pages",
      baseUrl = "/",
      transition,
      preloaded,
    } = config
    this.enableTransitions = !!transition
    const [normalizedDir, normalizedBaseUrl] = [
      normalizePrefixPath(dir),
      normalizePrefixPath(baseUrl),
    ]
    this.baseUrl = normalizedBaseUrl.slice(0, -1)

    if (preloaded) {
      const {
        pages,
        layouts,
        page,
        pageProps,
        pageLayouts,
        route,
        params,
        query,
        cacheData,
      } = preloaded
      this.state.pathname.value = window.location.pathname
      this.state.hash.value = window.location.hash
      this.state.params.value = params
      this.state.query.value = query
      this.state.signal = this.abortController.signal
      this.currentPage.value = {
        component: page.default,
        config: page.config,
        route,
      }
      this.currentPageProps.value = pageProps
      this.currentLayouts.value = pageLayouts.map((l) => l.default)
      this.pages = pages
      this.layouts = layouts
      if (__DEV__) {
        if (page.config) {
          this.dev_onPageConfigDefined!(route, page.config)
        }
      }
      if (__DEV__) {
        validateRoutes(this.pages)
      }
      const loader = page.config?.loader
      if (
        loader &&
        ((loader.mode !== "static" && pageProps.loading === true) || __DEV__)
      ) {
        if (cacheData === null) {
          const { pathname, hash, params, query, signal } = this.state
          this.loadRouteData(page.config as PageConfigWithLoader, pageProps, {
            pathname: pathname.peek(),
            hash: hash.peek(),
            params: params.peek(),
            query: query.peek(),
            signal,
          })
        } else {
          nextIdle(() => {
            const props = {
              ...pageProps,
              data: cacheData.value,
              error: null,
              loading: false,
            }
            // @ts-ignore
            const transition = loader.transition ?? this.enableTransitions
            handleStateTransition(this.state.signal, transition, () => {
              this.currentPageProps.value = props
            })
          })
        }
      }
    } else {
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
      if (__DEV__) {
        validateRoutes(this.pages)
      }
      this.loadRoute()
    }

    window.history.scrollRestoration = "manual"

    const historyState = window.history.state as unknown
    if (
      typeof historyState !== "object" ||
      historyState === null ||
      !("index" in historyState) ||
      typeof historyState.index !== "number"
    ) {
      const offset = window.history.length - 1
      this.historyIndex = offset
      if (offset !== 0) {
        scrollStack.save(Array.from({ length: offset }, () => [0, 0]))
      }

      window.history.replaceState(
        { ...window.history.state, index: this.historyIndex },
        "",
        window.location.href
      )
    } else {
      const { index } = historyState
      if (index > 0) {
        this.historyIndex = index
        const offset = scrollStack.getItem(index)
        if (offset !== undefined) {
          window.scrollTo(...offset)
        }
      }
    }

    window.addEventListener("beforeunload", () => {
      scrollStack.replace(this.historyIndex, window.scrollX, window.scrollY)
      window.history.scrollRestoration = "auto"
    })

    window.addEventListener("popstate", (e) => {
      e.preventDefault()
      scrollStack.replace(this.historyIndex, window.scrollX, window.scrollY)

      this.loadRoute().then(() => {
        if (e.state != null) {
          this.historyIndex = e.state.index
          const offset = scrollStack.getItem(e.state.index)
          if (offset !== undefined) {
            window.scrollTo(...offset)
          }
        }
      })
    })
  }

  public getChildren() {
    const page = this.currentPage.value
    if (!page) return null

    const props = this.currentPageProps.value,
      layouts = this.currentLayouts.value

    return wrapWithLayouts(layouts, page.component, props)
  }

  public dispose() {
    this.abortController?.abort()
    if (__DEV__) {
      this.filePathToPageRoute?.clear()
      this.pageRouteToConfig?.clear()
    }
    fileRouterRoute.current = null
    fileRouterInstance.current = null
  }

  private async loadRoute(
    path: string = window.location.pathname,
    props: Record<string, unknown> = {},
    enableTransition = this.enableTransitions,
    isStatic404 = false
  ): Promise<void> {
    this.abortController?.abort()
    const signal = (this.abortController = new AbortController()).signal

    try {
      const pathSegments = path.split("/").filter(Boolean)
      let routeMatch = matchRoute(this.pages, pathSegments)

      if (!routeMatch || isStatic404) {
        // Try to find a 404 page in parent directories
        const _404Match = match404Route(this.pages, pathSegments)
        if (!_404Match) {
          if (__DEV__) {
            console.error(
              `[kiru/router]: No 404 route defined (path: ${path}). 
See https://kirujs.dev/docs/api/file-router#404 for more information.`
            )
          }
          return
        }
        routeMatch = _404Match
      }

      const { route, pageEntry, params, routeSegments } = routeMatch

      fileRouterRoute.current = route
      const pagePromise = pageEntry.load()

      const layoutPromises = matchLayouts(this.layouts, routeSegments).map(
        (layoutEntry) => layoutEntry.load()
      )

      const [page, ...layouts] = await Promise.all([
        pagePromise,
        ...layoutPromises,
      ])

      const query = parseQuery(window.location.search)
      fileRouterRoute.current = null
      if (signal.aborted) return

      if (typeof page.default !== "function") {
        throw new Error(
          "[kiru/router]: Route component must be a default exported function"
        )
      }

      const loaderContext: PageDataLoaderContext = {
        pathname: path,
        hash: window.location.hash,
        params,
        query,
        signal,
      }

      let config = page.config ?? ({} as PageConfig)
      if (__DEV__) {
        if (this.pageRouteToConfig?.has(route)) {
          config = this.pageRouteToConfig.get(route)!
        }
      }

      const { loader } = config

      if (loader) {
        if (loader.mode !== "static" || __DEV__) {
          // Check cache first if caching is enabled
          let cachedData = null
          if (loader.mode !== "static" && loader.cache) {
            const cacheKey: CacheKey = {
              path: loaderContext.pathname,
              params: loaderContext.params,
              query: loaderContext.query,
            }
            cachedData = routerCache.current!.get(cacheKey, loader.cache)
          }

          if (cachedData !== null) {
            // Use cached data immediately - no loading state needed
            props = {
              ...props,
              data: cachedData.value,
              error: null,
              loading: false,
            } satisfies PageProps<PageConfig<unknown>>
          } else {
            // No cached data - show loading state and load data
            props = {
              ...props,
              loading: true,
              data: null,
              error: null,
            } satisfies PageProps<PageConfig<unknown>>

            this.loadRouteData(
              config as PageConfigWithLoader,
              props,
              loaderContext,
              enableTransition
            )
          }
        } else {
          const staticProps = page.__KIRU_STATIC_PROPS__?.[path]
          if (!staticProps) {
            return this.loadRoute(path, props, enableTransition, true)
          }

          const { data, error } = staticProps
          props = {
            ...props,
            data: data,
            error: error ? new FileRouterDataLoadError(error) : null,
            loading: false,
          } as PageProps<PageConfig<unknown>>
        }
      }

      return handleStateTransition(signal, enableTransition, () => {
        this.state.pathname.value = path
        this.state.hash.value = window.location.hash
        this.state.params.value = params
        this.state.query.value = query
        this.state.signal = signal
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
    config: PageConfigWithLoader,
    props: Record<string, unknown>,
    context: PageDataLoaderContext,
    enableTransition = this.enableTransitions
  ) {
    const { loader } = config

    // Load data from loader (cache check is now done earlier in loadRoute)
    loader
      .load(context)
      .then(
        (data) => {
          // Cache the data if caching is enabled
          if (loader.mode !== "static" && loader.cache) {
            const cacheKey: CacheKey = {
              path: context.pathname,
              params: context.params,
              query: context.query,
            }
            routerCache.current!.set(cacheKey, data, loader.cache)
          }

          return {
            data,
            error: null,
            loading: false,
          } satisfies PageProps<PageConfig<unknown>>
        },
        (error) =>
          ({
            data: null,
            error: new FileRouterDataLoadError(error),
            loading: false,
          } satisfies PageProps<PageConfig<unknown>>)
      )
      .then((state) => {
        if (context.signal.aborted) return

        const transition =
          (loader.mode !== "static" && loader.transition) ?? enableTransition

        handleStateTransition(context.signal, transition, () => {
          this.currentPageProps.value = {
            ...props,
            ...state,
          } satisfies PageProps<PageConfig<unknown>>
        })
      })
  }

  private invalidate(...paths: string[]) {
    // Invalidate cache entries
    routerCache.current!.invalidate(...paths)

    // Check if current page matches any invalidated paths
    const currentPath = this.state.pathname.peek()
    const shouldRefresh = routerCache.current!.pathMatchesPattern(
      currentPath,
      paths
    )

    return shouldRefresh
  }

  private async navigate(
    path: string,
    options?: {
      replace?: boolean
      transition?: boolean
    }
  ) {
    const url = new URL(path, "http://localhost")
    const { hash: nextHash, pathname: nextPath } = url
    const prevHash = this.state.hash.peek()
    const prevPath = this.state.pathname.peek()
    if (nextHash === prevHash && nextPath === prevPath) {
      return
    }

    this.updateHistoryState(path, options)

    this.loadRoute(
      void 0,
      void 0,
      options?.transition ?? this.enableTransitions
    ).then(() => {
      if (nextHash !== prevHash) {
        window.dispatchEvent(new HashChangeEvent("hashchange"))
      }

      let anchorEl
      if (nextHash && (anchorEl = document.getElementById(nextHash.slice(1)))) {
        anchorEl.scrollIntoView()
      } else {
        window.scrollTo(0, 0)
      }
    })
  }

  private async prefetchRouteModules(path: string) {
    const url = new URL(path, "http://localhost")
    try {
      const routeMatch = matchRoute(
        this.pages,
        url.pathname.split("/").filter(Boolean)
      )
      if (!routeMatch) {
        throw new Error(`No route defined (path: ${path}).`)
      }
      const { pageEntry, route } = routeMatch
      fileRouterRoute.current = route
      const pagePromise = pageEntry.load()
      const layoutPromises = matchLayouts(this.layouts, route.split("/")).map(
        (layoutEntry) => layoutEntry.load()
      )
      await Promise.all([pagePromise, ...layoutPromises])
      fileRouterRoute.current = null
    } catch (error) {
      console.error("[kiru/router]: Failed to prefetch route:", error)
    }
  }

  private setQuery(query: RouteQuery, options?: { replace?: boolean }) {
    const queryString = buildQueryString(query)
    const newUrl = `${this.state.pathname.peek()}${
      queryString ? `?${queryString}` : ""
    }`
    this.updateHistoryState(newUrl, options)
    this.state.query.value = query
    return this.loadRoute()
  }

  private async setHash(hash: string, options?: { replace?: boolean }) {
    if (hash === "#") {
      hash = ""
    } else if (hash.length && !hash.startsWith("#")) {
      hash = `#${hash}`
    }
    if (hash === this.state.hash.peek()) {
      return
    }
    this.updateHistoryState(`${this.state.pathname.peek()}${hash}`, options)
    this.state.hash.value = hash
    return this.loadRoute()
  }

  private async updateHistoryState(
    path: string,
    options?: { replace?: boolean }
  ) {
    if (options?.replace) {
      scrollStack.replace(this.historyIndex, window.scrollX, window.scrollY)
      window.history.replaceState(
        { ...window.history.state, index: this.historyIndex },
        "",
        path
      )
    } else {
      // if we've gone back and are now going forward, we need to
      // truncate the scroll stack so it doesn't just permanently grow.
      // this should keep it at the same length as the history stack.
      const current = scrollStack.get()
      if (this.historyIndex < window.history.length - 1) {
        current.length = this.historyIndex
      }
      scrollStack.save([...current, [window.scrollX, window.scrollY]])
      window.history.pushState(
        { ...window.history.state, index: ++this.historyIndex },
        "",
        path
      )
    }
  }
  private createContextValue() {
    const __this = this
    return {
      get baseUrl() {
        return __this.baseUrl
      },
      invalidate: async (...paths: string[]) => {
        if (this.invalidate(...paths)) {
          return this.loadRoute(void 0, void 0, true)
        }
      },
      get state() {
        return __this.state
      },
      navigate: this.navigate.bind(this),
      prefetchRouteModules: this.prefetchRouteModules.bind(this),
      reload: async (options?: ReloadOptions) => {
        if (options?.invalidate ?? true) {
          this.invalidate(this.state.pathname.peek())
        }
        return this.loadRoute(void 0, void 0, options?.transition)
      },
      setQuery: this.setQuery.bind(this),
      setHash: this.setHash.bind(this),
    }
  }
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

async function handleStateTransition(
  signal: AbortSignal,
  enableTransition: boolean,
  callback: () => void
) {
  if (!enableTransition) {
    return new Promise<void>((resolve) => {
      callback()
      nextIdle(resolve)
    })
  }
  await ViewTransitions.run(callback, { signal })
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
    warning += routeConflicts
      .map(([route1, route2]) => {
        return `  - "${route1.filePath}" conflicts with "${route2.filePath}"\n`
      })
      .join("")
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

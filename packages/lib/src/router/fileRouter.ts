import { Signal, computed } from "../index.js"
import { createElement } from "../element.js"
import { useState, useEffect } from "../hooks/index.js"
import { RouterContext, type FileRouterContextType } from "./context.js"
import {
  ErrorPageProps,
  LayoutModule,
  PageConfig,
  PageProps,
  RouteQuery,
  RouterState,
  ViteLayoutsImportMap,
  VitePagesImportMap,
} from "./types.js"
import { FileRouterDataLoadError } from "./errors.js"
import { __DEV__ } from "../env.js"

class FileRouterController {
  private pages: VitePagesImportMap
  private layouts: ViteLayoutsImportMap
  private abortController: AbortController
  private currentPage: Signal<Kiru.FC<any> | null>
  private currentPageProps: Signal<PageProps<PageConfig>>
  private currentLayouts: Signal<Kiru.FC[]>
  private loading: Signal<boolean>
  private state: Signal<RouterState>
  private contextValue: Signal<FileRouterContextType>
  private cleanups: (() => void)[] = []

  constructor() {
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
      reload: () => this.loadRoute(),
    }))
    this.loadRoutes().then(() => this.loadRoute())

    const handlePopState = () => this.loadRoute()
    window.addEventListener("popstate", handlePopState)
    this.cleanups.push(() =>
      window.removeEventListener("popstate", handlePopState)
    )
  }

  public getContextValue() {
    return this.contextValue.value
  }

  public getChildren() {
    const Page = this.currentPage.value,
      props = this.currentPageProps.value,
      layouts = this.currentLayouts.value

    if (Page) {
      // Wrap component with layouts (outermost first)
      return layouts.reduceRight(
        (children, Layout) => createElement(Layout, { children }),
        createElement(Page, props)
      )
    }

    return null
  }

  public dispose() {
    this.cleanups.forEach((cleanup) => cleanup())
  }

  private async loadRoutes() {
    let manifest: typeof import("virtual:kiru-file-router-manifest")
    try {
      manifest = await import("virtual:kiru-file-router-manifest")
    } catch (error) {
      console.error(error)
      manifest = {
        pages: {},
        layouts: {},
      }
    }
    const { pages, layouts } = manifest

    this.pages = formatViteMap(pages)
    this.layouts = formatViteMap(layouts)
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

      return { pageModuleLoader, params, routeSegments }
    }

    return null
  }

  private async loadRoute(
    path: string = window.location.pathname,
    props: PageProps<PageConfig> = {}
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

      const { pageModuleLoader, params, routeSegments } = routeMatch

      const pagePromise = pageModuleLoader()
      const layoutPromises = ["/", ...routeSegments].reduce((acc, _, i) => {
        const layoutPath = "/" + routeSegments.slice(0, i).join("/")
        const layoutLoad = this.layouts[layoutPath]

        if (!layoutLoad) {
          return acc
        }

        return [...acc, layoutLoad()]
      }, [] as Promise<LayoutModule>[])

      const [page, ...layouts] = await Promise.all([
        pagePromise,
        ...layoutPromises,
      ])

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

      if (page.config?.loader) {
        props = { ...props, loading: true, data: null, error: null }

        page.config.loader
          .load(controller.signal, routerState)
          .then(
            (data) => ({ data, error: null }),
            (error) => ({
              data: null,
              error: new FileRouterDataLoadError(error),
            })
          )
          .then(({ data, error }) => {
            if (controller.signal.aborted) return
            this.currentPageProps.value = {
              ...props,
              loading: false,
              data,
              error,
            }
          })
      }

      this.currentPage.value = page.default
      this.state.value = routerState
      this.currentPageProps.value = props
      this.currentLayouts.value = layouts
        .filter((m) => typeof m.default === "function")
        .map((m) => m.default)
    } catch (error) {
      console.error("Failed to load route component:", error)
      this.currentPage.value = null
    } finally {
      this.loading.value = false
    }
  }

  private async navigate(
    path: string,
    options?: { replace?: boolean; props?: Record<string, unknown> }
  ) {
    const f = options?.replace ? "replaceState" : "pushState"
    window.history[f]({}, "", path)
    window.dispatchEvent(new PopStateEvent("popstate", { state: {} }))
    return this.loadRoute(path, options?.props)
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

export function FileRouter(): JSX.Element {
  const [controller] = useState(() => new FileRouterController())
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

function formatViteMap(map: VitePagesImportMap): VitePagesImportMap {
  return Object.keys(map).reduce((acc, key) => {
    let k = key
    if (k.startsWith(".")) {
      k = k.slice(1)
    }
    k = k.split("/").slice(0, -1).join("/") // remove filename

    k = k.replace(/\[([^\]]+)\]/g, ":$1") // replace [param] with :param

    return {
      ...acc,
      [k || "/"]: map[key],
    }
  }, {})
}

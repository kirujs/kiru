import { Signal, computed } from "../index.js"
import { createElement } from "../element.js"
import { useState, useEffect } from "../hooks/index.js"
import { RouterContext, type FileRouterContextType } from "./context.js"
import { RouteQuery, ViteImportMap } from "./types.js"

class FileRouterController {
  private pages: ViteImportMap
  private layouts: ViteImportMap
  private currentComponent: Signal<Kiru.FC | null>
  private currentLayouts: Signal<Kiru.FC[]>
  private loading: Signal<boolean>
  private state: Signal<{
    path: string
    params: Record<string, string>
    query: Record<string, string | string[] | undefined>
  }>
  private contextValue: Signal<FileRouterContextType>
  private cleanups: (() => void)[] = []

  constructor() {
    this.pages = {}
    this.layouts = {}
    this.currentComponent = new Signal(null)
    this.currentLayouts = new Signal([])
    this.loading = new Signal(true)
    this.state = new Signal({
      path: window.location.pathname,
      params: {},
      query: parseQuery(window.location.search),
    })
    this.contextValue = computed(() => ({
      state: this.state.value,
      navigate: this.navigate.bind(this),
      setQuery: this.setQuery.bind(this),
    }))
    this.loadRoutes().then(() => this.loadCurrentRoute())

    const handlePopState = () => {
      const path = window.location.pathname
      const query = parseQuery(window.location.search)
      this.state.value = { path, params: {}, query }
      this.loadCurrentRoute()
    }
    window.addEventListener("popstate", handlePopState)
    this.cleanups.push(() =>
      window.removeEventListener("popstate", handlePopState)
    )
  }

  public getContextValue() {
    return this.contextValue.value
  }

  public getChildren() {
    const currentComponent = this.currentComponent.value,
      layouts = this.currentLayouts.value

    if (currentComponent) {
      // Wrap component with layouts (outermost first)
      return layouts.reduceRight(
        (children, Layout) => createElement(Layout, { children }),
        createElement(currentComponent)
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

    const formatViteMap = (map: ViteImportMap): ViteImportMap => {
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

    this.pages = formatViteMap(pages)
    this.layouts = formatViteMap(layouts)
  }

  private matchRoute(pathSegments: string[]) {
    outer: for (const [route, load] of Object.entries(this.pages)) {
      const routeSegments = route.split("/").filter(Boolean)
      if (routeSegments.length !== pathSegments.length) {
        continue
      }
      const params: Record<string, string> = {}

      for (let i = 0; i < routeSegments.length; i++) {
        const routeSeg = routeSegments[i]
        if (routeSeg.startsWith(":")) {
          const key = routeSeg.slice(1)
          params[key] = pathSegments[i]
          continue
        }
        if (routeSeg !== pathSegments[i]) {
          continue outer
        }
      }

      return { load, params, routeSegments }
    }

    return null
  }

  private async loadCurrentRoute() {
    this.loading.value = true

    try {
      const pathSegments = this.state.value.path.split("/").filter(Boolean)
      const matchingRoute = this.matchRoute(pathSegments)

      if (!matchingRoute) {
        this.currentComponent.value = null
        this.currentLayouts.value = []
        return
      }

      const { load, params, routeSegments } = matchingRoute

      const pagePromise = load().then((m) => m.default)
      const layoutPromises = Object.keys(this.layouts)
        .sort((a, b) => a.split("/").length - b.split("/").length)
        .reduce<Promise<Kiru.FC>[]>((acc, k) => {
          const layoutSegments = k.split("/").filter(Boolean)
          if (layoutSegments.length > routeSegments.length) {
            return acc
          }
          const applies = layoutSegments.every((segment, i) => {
            const routeSegment = routeSegments[i]
            return routeSegment.startsWith(":") || segment === routeSegment
          })
          if (!applies) {
            return acc
          }
          return [...acc, this.layouts[k]().then((m) => m.default)]
        }, [])

      const [Page, ...Layouts] = await Promise.all([
        pagePromise,
        ...layoutPromises,
      ])

      this.state.value = {
        ...this.state.value,
        params,
        query: parseQuery(window.location.search),
      }

      this.currentLayouts.value = Layouts
      this.currentComponent.value = Page
    } catch (error) {
      console.error("Failed to load route component:", error)
      this.currentComponent.value = null
    } finally {
      this.loading.value = false
    }
  }

  private navigate(path: string, options?: { replace?: boolean }) {
    const f = options?.replace ? "replaceState" : "pushState"
    window.history[f]({}, "", path)
    window.dispatchEvent(new PopStateEvent("popstate", { state: {} }))

    this.state.value = { ...this.state.value, path, params: {} }
    this.loadCurrentRoute()
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

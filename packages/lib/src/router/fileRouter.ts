import { computed, Signal } from "../signals/index.js"
import { createElement } from "../element.js"
import { useState, useEffect } from "../hooks/index.js"
import {
  RouterContext,
  type RouterContextValue,
  type FileRouteInfo,
} from "./index.js"

class FileRouterController {
  private routes: FileRouteInfo[] = []
  private currentComponent: Signal<Kiru.FC | null>
  private currentLayouts: Signal<Kiru.FC[]>
  private loading: Signal<boolean>
  private props: FileRouterProps
  private state: Signal<{
    path: string
    params: Record<string, string>
    query: Record<string, string | string[] | undefined>
  }>
  private contextValue: Signal<RouterContextValue>
  private cleanups: (() => void)[] = []

  constructor(props: FileRouterProps) {
    this.currentComponent = new Signal(null)
    this.currentLayouts = new Signal([])
    this.loading = new Signal(true)
    this.props = props
    this.state = new Signal({
      path: window.location.pathname,
      params: {},
      query: parseQuery(window.location.search),
    })
    this.contextValue = computed(() => ({
      routes: this.routes,
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

  public updateProps(props: FileRouterProps) {
    this.props = props
  }

  public getContextValue() {
    return this.contextValue.value
  }

  public getChildren() {
    const loading = this.loading.value,
      fallback = this.props.fallback,
      currentComponent = this.currentComponent.value,
      layouts = this.currentLayouts.value

    if (currentComponent) {
      // Wrap component with layouts (outermost first)
      let content = createElement(currentComponent)

      for (let i = layouts.length - 1; i >= 0; i--) {
        content = createElement(layouts[i], { children: content })
      }

      return content
    }

    return loading ? fallback : null
  }

  public dispose() {
    this.cleanups.forEach((cleanup) => cleanup())
  }

  private async loadRoutes() {
    try {
      const manifest = await import("virtual:kiru-file-router-manifest")
      this.routes.push(...manifest.default.routes)
    } catch (error) {
      console.warn("Failed to load routes:", error)
      this.routes.length = 0
    }
  }

  private async loadCurrentRoute() {
    if (this.routes.length === 0) return

    this.loading.value = true

    try {
      const matchingRoute = findMatchingRoute(
        this.state.value.path,
        this.routes
      )

      if (matchingRoute) {
        const { routeMap, layoutMap } = await import("virtual:kiru-file-router")

        // Extract parameters from the current path
        const params = extractParamsFromPath(
          this.state.value.path,
          matchingRoute
        )

        // Update state with extracted parameters
        this.state.value = { ...this.state.value, params }

        // Load layouts
        const layoutComponents: Kiru.FC[] = []
        for (const layout of matchingRoute.layouts) {
          const LayoutComponent = layoutMap[layout.filePath]
          if (LayoutComponent) {
            layoutComponents.push(LayoutComponent)
          }
        }
        this.currentLayouts.value = layoutComponents

        // Load page component
        const Component = routeMap[matchingRoute.path]

        if (Component) {
          if (this.props.transition && "startViewTransition" in document) {
            document.startViewTransition(() => {
              this.currentComponent.value = Component
            })
          } else {
            this.currentComponent.value = Component
          }
        } else {
          console.warn(`No component found for route`, {
            routeMap,
            matchingRoute,
          })
          this.currentComponent.value = null
        }
      } else {
        this.currentComponent.value = null
        this.currentLayouts.value = []
      }
    } catch (error) {
      console.error("Failed to load route component:", error)
      this.currentComponent.value = null
    } finally {
      this.loading.value = false
    }
  }

  private navigate(path: string) {
    window.history.pushState(null, "", path)
    this.state.value = { ...this.state.value, path, params: {} }
    this.loadCurrentRoute()
  }

  private setQuery(query: Record<string, string | string[] | undefined>) {
    const queryString = buildQueryString(query)
    const newUrl = `${this.state.value.path}${
      queryString ? `?${queryString}` : ""
    }`
    window.history.pushState(null, "", newUrl)
    this.state.value = { ...this.state.value, query }
  }
}

interface FileRouterProps {
  fallback?: JSX.Element
  transition?: boolean
}

export function FileRouter(props: FileRouterProps): JSX.Element {
  const [controller] = useState(() => new FileRouterController(props))
  controller.updateProps(props)
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

// Utility function to find matching route
function findMatchingRoute(
  path: string,
  routes: FileRouteInfo[]
): FileRouteInfo | null {
  // First try exact matches
  const exactMatch = routes.find((route) => route.path === path)
  if (exactMatch) return exactMatch

  // Then try parameterized matches
  for (const route of routes) {
    if (route.params.length > 0) {
      const pathSegments = path.split("/").filter(Boolean)
      const routeSegments = route.path.split("/").filter(Boolean)

      if (pathSegments.length === routeSegments.length) {
        let matches = true
        for (let i = 0; i < pathSegments.length; i++) {
          const routeSegment = routeSegments[i]
          if (
            !routeSegment.startsWith(":") &&
            pathSegments[i] !== routeSegment
          ) {
            matches = false
            break
          }
        }
        if (matches) return route
      }
    }
  }

  return null
}

function extractParamsFromPath(
  path: string,
  route: FileRouteInfo
): Record<string, string> {
  const params: Record<string, string> = {}
  const pathSegments = path.split("/").filter(Boolean)
  const routeSegments = route.path.split("/").filter(Boolean)

  for (let i = 0; i < routeSegments.length; i++) {
    const routeSegment = routeSegments[i]
    if (routeSegment.startsWith(":")) {
      const paramName = routeSegment.slice(1) // Remove the ':'
      params[paramName] = pathSegments[i] || ""
    }
  }

  return params
}

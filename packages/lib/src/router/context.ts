import { createContext } from "../context.js"
import { __DEV__ } from "../env.js"
import { useContext } from "../hooks/index.js"
import type { RouteQuery, RouterState } from "./types.js"

export interface ReloadOptions {
  /**
   * Trigger a view transition (overrides transition from config)
   * @default false
   */
  transition?: boolean
  /**
   * Invalidate the cache for the current route
   * @default true
   */
  invalidate?: boolean
}

export interface FileRouterContextType {
  /**
   * The base URL of the router
   * @default "/"
   */
  baseUrl: string
  /**
   * Invalidate cached loader data for the given paths
   * @example
   * invalidate("/users", "/posts", "/users/1")
   * // or invalidate based on folder path
   * invalidate("/users/[id]") // (invalidates /users/1, /users/2, etc.)
   */
  invalidate(...paths: string[]): Promise<void>
  /**
   * The current router state
   */
  state: RouterState

  /**
   * Navigate to a new route, optionally replacing the current route
   * in the history stack or triggering a view transition
   */
  navigate: (
    path: string,
    options?: { replace?: boolean; transition?: boolean }
  ) => Promise<void>

  /**
   * Prefetch a route module and its dependencies to be loaded in the background
   */
  prefetchRouteModules: (path: string) => void

  /**
   * Reload the current route, optionally triggering a view transition
   */
  reload: (options?: {
    transition?: boolean
    invalidate?: boolean
  }) => Promise<void>

  /**
   * Set the current query parameters
   */
  setQuery: (
    query: RouteQuery,
    options?: { replace?: boolean }
  ) => Promise<void>

  /**
   * Set the current hash
   */
  setHash: (hash: string, options?: { replace?: boolean }) => Promise<void>
}

export const RouterContext = createContext<FileRouterContextType>(null!)
if (__DEV__) {
  RouterContext.displayName = "RouterContext"
}

export function useFileRouter(): FileRouterContextType {
  return useContext(RouterContext)
}

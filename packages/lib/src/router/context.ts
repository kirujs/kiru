import { useContext } from "../hooks/index.js"
import { sideEffectsEnabled } from "../utils/runtime.js"
import { createContext } from "../context.js"
import { __DEV__ } from "../env.js"
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

export const RequestContext = createContext<Kiru.RequestContext>(null!)
let clientRequestData: Kiru.RequestContext | null = null

function useClientRequestData(): Kiru.RequestContext {
  if (clientRequestData === null) {
    const script = document.querySelector("[k-request-context]")
    if (!script) {
      throw new Error(
        "[kiru/router]: unable to parse request context from document"
      )
    }
    clientRequestData = JSON.parse(script.innerHTML)
  }
  return clientRequestData as Kiru.RequestContext
}

export function useRequestContext() {
  if (sideEffectsEnabled()) {
    return useClientRequestData()
  }
  return useContext(RequestContext)
}

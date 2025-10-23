import { createContext } from "../context.js"
import { __DEV__ } from "../env.js"
import { useContext } from "../hooks/index.js"
import type { RouteQuery, RouterState } from "./types.js"

export interface FileRouterContextType {
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
   * Reload the current route, optionally triggering a view transition
   */
  reload: (options?: { transition?: boolean }) => Promise<void>
  /**
   * Set the current query parameters
   */
  setQuery: (query: RouteQuery) => void
}

export const RouterContext = createContext<FileRouterContextType>(null!)
if (__DEV__) {
  RouterContext.displayName = "RouterContext"
}

export function useFileRouter(): FileRouterContextType {
  return useContext(RouterContext)
}

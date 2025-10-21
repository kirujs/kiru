import { createContext } from "../context.js"
import { useContext } from "../hooks/index.js"
import type { FileRouteInfo, RouteQuery, RouterState } from "./types.js"

export interface FileRouterContextType {
  routes: FileRouteInfo[]
  state: RouterState
  navigate: (path: string, options?: { replace?: boolean }) => void
  setQuery: (query: RouteQuery) => void
}

export const RouterContext = createContext<FileRouterContextType>(null!)

export function useFileRouter(): FileRouterContextType {
  return useContext(RouterContext)
}

import { createContext } from "../context.js"
import { __DEV__ } from "../env.js"
import { useContext } from "../hooks/index.js"
import type { RouteQuery, RouterState } from "./types.js"

export interface FileRouterContextType {
  state: RouterState
  navigate: (
    path: string,
    options?: { replace?: boolean; transition?: boolean }
  ) => Promise<void>
  reload: (options?: { transition?: boolean }) => Promise<void>
  setQuery: (query: RouteQuery) => void
}

export const RouterContext = createContext<FileRouterContextType>(null!)
if (__DEV__) {
  RouterContext.displayName = "RouterContext"
}

export function useFileRouter(): FileRouterContextType {
  return useContext(RouterContext)
}

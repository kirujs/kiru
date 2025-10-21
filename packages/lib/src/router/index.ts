import { createContext } from "../context.js"
import { useContext } from "../hooks/index.js"
import { createElement } from "../element.js"

type FC<T = {}> = (props: T) => any

// Router types
export interface RouteParams {
  [key: string]: string
}

export interface RouteQuery {
  [key: string]: string | string[] | undefined
}

export interface RouterState {
  path: string
  params: RouteParams
  query: RouteQuery
}

export interface RouterContextValue {
  routes: FileRouteInfo[]
  state: RouterState
  navigate: (path: string) => void
  setQuery: (query: RouteQuery) => void
}

export interface FileRouteInfo {
  path: string
  filePath: string
  params: string[]
  layouts: LayoutInfo[]
}

export interface LayoutInfo {
  path: string
  filePath: string
  level: number
}

// Router context
const RouterContext = createContext<RouterContextValue>({
  routes: [],
  state: { path: "", params: {}, query: {} },
  navigate: () => {},
  setQuery: () => {},
})

// useFileRouter hook
export function useFileRouter(): RouterContextValue {
  return useContext(RouterContext)
}

// Link component
export interface LinkProps {
  to: string
  children: any
  className?: string
  style?: any
  onClick?: (e: any) => void
}

export const Link: FC<LinkProps> = ({
  to,
  children,
  className,
  style,
  onClick,
  ...props
}) => {
  const { navigate } = useFileRouter()

  const handleClick = (e: any) => {
    e.preventDefault()
    navigate(to)
    onClick?.(e)
  }

  return createElement(
    "a",
    {
      href: to,
      onclick: handleClick,
      className,
      style,
      ...props,
    },
    children
  )
}

// Export the context for use by FileRouter
export { RouterContext }

import { createElement } from "../../element.js"
import { RouterContext } from "../context.js"
import type { RouterState } from "../types.js"

// children: doc, route: routeInfo.route, params: routeInfo.params, query: routeInfo.query, config: routeInfo.config

interface FileRouterProps {
  children: JSX.Children
  state: RouterState
}

export function FileRouter({ children, state }: FileRouterProps): JSX.Element {
  return createElement(RouterContext.Provider, { value: { state }, children })
}

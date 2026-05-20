import { createContext, useContext } from "../context.js"
import { createElement } from "../element.js"
import { RequestContextProvider } from "./requestContext.js"
import type { Router } from "./routerInstance.js"

const RouterContext = createContext<Router | null>(null)

export interface RouterProviderProps {
  router: Router
  children?: JSX.Children
}

const RequestContextBridge: Kiru.Component<{
  router: Router
  children?: JSX.Children
}> = ({ router, children }) => {
  return createElement(RequestContextProvider, {
    value: router.requestContext.value,
    children,
  })
}

export function RouterProvider({ router, children }: RouterProviderProps) {
  return createElement(RouterContext, {
    value: router,
    children: createElement(RequestContextBridge, { router, children }),
  })
}

export function useRouter(): Router {
  const router = useContext(RouterContext)
  if (!router) throw new Error("useRouter must be used inside RouterProvider")
  return router
}

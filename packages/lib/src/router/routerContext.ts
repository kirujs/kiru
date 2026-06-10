import { createContext, useContext } from "../context.js"
import { createElement, Fragment } from "../element.js"
import { onBeforeMount } from "../hooks/onBeforeMount.js"
import { sideEffectsEnabled } from "../utils/index.js"
import { ScopeInterceptorOutlets } from "./scopeInterceptorOutlets.js"
import { claimActiveRouter, releaseActiveRouter } from "./routerGlobal.js"
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
  if (sideEffectsEnabled()) {
    onBeforeMount(() => {
      claimActiveRouter(router)
      return () => releaseActiveRouter(router)
    })
  }
  return createElement(RouterContext, {
    value: router,
    children: createElement(RequestContextBridge, {
      router,
      children: createElement(Fragment, {}, [
        createElement(ScopeInterceptorOutlets, {}),
        children,
      ]),
    }),
  })
}

export function useRouter(): Router {
  const router = useContext(RouterContext)
  if (!router) throw new Error("useRouter must be used inside RouterProvider")
  return router
}

export function useOptionalRouter(): Router | null {
  return useContext(RouterContext)
}

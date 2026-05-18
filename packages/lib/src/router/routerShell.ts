import { createElement } from "../element.js"
import { RouterProvider, type Router } from "./csr.js"
import { RequestContextProvider } from "./requestContext.js"
import type { CustomRequestContext } from "./types.js"

/**
 * SSR/SSG app shell: request context, router provider, and an inline outlet
 * (`() => …` → `$INLINE_FN`) so loader/nav updates reconcile only the route subtree.
 */
export function createSsrRouterShell(
  router: Router,
  requestContext: CustomRequestContext,
  outlet: () => JSX.Children
) {
  return createElement(RequestContextProvider, {
    value: requestContext,
    children: createElement(RouterProvider, {
      router,
      children: outlet,
    }),
  })
}

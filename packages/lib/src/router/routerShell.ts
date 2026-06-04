import { createElement } from "../element.js"
import { RouterProvider, type Router } from "./csr.js"
import {
  I18nProvider,
  I18nReactiveRoot,
  type I18nContextValue,
} from "./i18nContext.js"
import type { createI18nRuntime } from "./i18nContext.js"
import { RequestContextProvider } from "./requestContext.js"
import type { CustomRequestContext } from "./types.js"

/**
 * SSR/SSG app shell: request context, optional i18n, router provider, and an inline outlet
 * (`() => …` → `$INLINE_FN`) so loader/nav updates reconcile only the route subtree.
 */
export function createSsrRouterShell(
  router: Router,
  requestContext: CustomRequestContext,
  outlet: JSX.Children,
  i18n?: I18nContextValue | (() => I18nContextValue),
  i18nRuntime?: ReturnType<typeof createI18nRuntime<unknown>>
) {
  const withRouter = createElement(RouterProvider, {
    router,
    children: outlet,
  })
  let withI18n: JSX.Element = withRouter
  if (i18nRuntime) {
    withI18n = createElement(I18nReactiveRoot, {
      runtime: i18nRuntime,
      children: withRouter,
    })
  } else if (i18n != null) {
    const resolved = typeof i18n === "function" ? i18n() : i18n
    withI18n = createElement(I18nProvider, {
      value: resolved,
      children: withRouter,
    })
  }
  return createElement(RequestContextProvider, {
    value: requestContext,
    children: withI18n,
  })
}

import { Fragment } from "../element.js"
import { renderMode } from "../globals.js"
import { headlessRender } from "../headlessRender.js"
import { mergeImagePreloadsIntoHead } from "../image/preloadRegistry.js"
import { createI18nRuntime, serializeI18nScript, type HydratedI18nPayload } from "./i18nContext.js"
import { serializeDocumentHead } from "./meta.js"
import { serializePageDataScript } from "./pageData.js"
import { serializeRequestContextScript } from "./requestContext.js"
import type { RouterPathPolicy } from "./pathPolicy.js"
import { mergeRouteAndPageHead } from "./pageHead.js"
import type { RouteHeadMeta } from "./types.js"
import { runWithSsrRequestContext } from "../remote/action.js"
import { createStaticRouter } from "./csr.js"
import { createSsrRouterShell } from "./routerShell.js"
import {
  buildRoutedSubtree,
  type LeafRouteProps,
} from "./routeTree.js"
import type {
  CustomRequestContext,
  DocumentHead,
  RouteManifest,
  RouteMatch,
  RouteModule,
} from "./types.js"
import type { RequestUrlState } from "./requestUrl.js"
import type { I18nLocaleRouting } from "./i18n/localeRouting.js"

export async function renderStringWithDocument(
  app: JSX.Element,
  match: RouteMatch,
  requestContext: CustomRequestContext,
  renderSignal: AbortSignal,
  pathPolicy?: RouterPathPolicy,
  pageData?: unknown,
  streamHeadMeta?: RouteHeadMeta,
  i18nPayload?: HydratedI18nPayload
): Promise<{ body: string; document: DocumentHead }> {
  let body = ""
  const prev = renderMode.current
  renderMode.current = "stream"
  try {
    runWithSsrRequestContext(requestContext, renderSignal, () => {
      headlessRender(
        {
          write(chunk) {
            body += chunk
          },
        },
        Fragment({ children: app })
      )
    })
  } finally {
    renderMode.current = prev
  }

  const resolvedMeta = mergeImagePreloadsIntoHead(
    streamHeadMeta ?? mergeRouteAndPageHead(match.route.head, undefined)
  )
  const ctxScript = serializeRequestContextScript(requestContext)
  const pageDataScript =
    pageData !== undefined ? serializePageDataScript(pageData) : ""
  const i18nScript =
    i18nPayload !== undefined ? serializeI18nScript(i18nPayload) : ""
  return {
    body,
    document: {
      headHtml:
        serializeDocumentHead(resolvedMeta, {
          pathname: match.pathname,
          pathPolicy,
        }) +
        (ctxScript ? `\n    ${ctxScript}` : "") +
        (i18nScript ? `\n    ${i18nScript}` : "") +
        (pageDataScript ? `\n    ${pageDataScript}` : ""),
      title: resolvedMeta.title,
    },
  }
}

export function buildAppElement(
  pathname: string,
  params: Record<string, string>,
  layoutModules: Array<RouteModule | null>,
  routeModule: RouteModule,
  manifest: RouteManifest,
  requestContext: CustomRequestContext,
  leafProps?: LeafRouteProps,
  options?: {
    url?: RequestUrlState
    pathPolicy?: RouterPathPolicy
    i18n?: HydratedI18nPayload
    localeRouting?: I18nLocaleRouting
  }
): JSX.Element {
  const staticRouter = createStaticRouter({
    manifest,
    pathname,
    query: options?.url?.query ?? {},
    hash: options?.url?.hash ?? "",
    pathPolicy: options?.pathPolicy,
    localeRouting: options?.localeRouting,
    locale: options?.i18n?.locale,
  })
  staticRouter.params.value = params
  const subtree = buildRoutedSubtree(layoutModules, routeModule, leafProps)
  const i18nRuntime = options?.i18n
    ? createI18nRuntime({
        initialLocale: options.i18n.locale,
        initialData: options.i18n.data,
        locales: options.i18n.locales ?? [options.i18n.locale],
        defaultLocale: options.i18n.defaultLocale ?? options.i18n.locale,
      })
    : undefined
  return createSsrRouterShell(
    staticRouter,
    requestContext,
    () => subtree,
    undefined,
    i18nRuntime
  )
}

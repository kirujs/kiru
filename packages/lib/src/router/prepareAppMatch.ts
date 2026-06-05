import { matchRoute } from "./manifest.js"
import type { RequestUrlState } from "./requestUrl.js"
import {
  buildMatchSegments,
  buildMiddlewareLocation,
} from "./navigation.js"
import { mergeRouteMeta } from "./routeMeta.js"
import { ensureResolvedRouteLayersForMatch } from "./routeLayerResolution.js"
import {
  runRouteMiddleware,
  toMiddlewareRedirect,
} from "./routeMiddleware.js"
import type {
  CustomRequestContext,
  RouteManifest,
  RouteMatch,
} from "./types.js"
import { loadNotFoundRouteTree, loadRouteTree } from "./routeTree.js"
import type { LeafRouteProps } from "./routeTree.js"
import { buildLoaderContext } from "./runPageLoad.js"
import { loaderSignalFromRequest, throwIfAborted } from "./navigationScope.js"
import type { KiruLoader, PageProps } from "./loaders.js"
import { validateSearchForMatch } from "./validateSearchForMatch.js"
import { resolveSsrRouteModule } from "./prepareRoute.js"
import {
  cachePolicyToHeaders,
  mergeResponseHeaders,
} from "./routeResponse.js"
import { getISRRevalidate, readRouteISRExport } from "./routeRevalidate.js"
import { serializedDataFromPageProps } from "./rendererStream.js"
import { buildAppElement } from "./ssrAppBuild.js"
import {
  loaderI18nFields,
  loadI18nMessages,
  getI18nLocaleRouting,
  type InternationalizationConfig,
} from "./i18n/index.js"
import type { HydratedI18nPayload } from "./i18nContext.js"
import { resolveStreamHeadMeta } from "./prepareAppHead.js"
import type { RenderRequestContext } from "./prepareAppTypes.js"
import type { PrepareError, PrepareRedirect, PreparedApp } from "./prepareAppTypes.js"
import { toPathname } from "./requestUrl.js"
import type { RouterPathPolicy } from "./pathPolicy.js"

export async function prepareNotFoundApp(
  manifest: RouteManifest,
  requestedPathname: string,
  requestUrl: RequestUrlState,
  pathPolicy: RouterPathPolicy,
  ctx: RenderRequestContext | undefined
): Promise<PreparedApp | null> {
  const notFoundTree = await loadNotFoundRouteTree(manifest, requestedPathname)
  if (!notFoundTree) return null
  const requestContext = (ctx?.context ?? {}) as CustomRequestContext
  const { layoutModules, routeModule } = notFoundTree
  const app = buildAppElement(
    requestedPathname,
    {},
    layoutModules,
    routeModule,
    manifest,
    requestContext,
    undefined,
    { url: requestUrl, pathPolicy }
  )
  return {
    app,
    routeMatch: null,
    requestContext,
    responseStatus: 404,
    responseHeaders: mergeResponseHeaders(ctx?.headers),
  }
}

export type MiddlewareStepResult =
  | { type: "continue" }
  | { type: "redirect"; path: string }
  | { type: "abort" }

export async function runMiddlewareForPath(
  routeMatch: RouteMatch,
  path: string,
  requestUrl: RequestUrlState,
  requestContext: CustomRequestContext,
  request?: Request
): Promise<MiddlewareStepResult | PrepareError> {
  await ensureResolvedRouteLayersForMatch(routeMatch)
  const href = `${path}${requestUrl.search}${requestUrl.hash}`
  const segments = buildMatchSegments(routeMatch)
  const mwTo = buildMiddlewareLocation(
    {
      pathname: routeMatch.pathname,
      hash: requestUrl.hash,
      query: requestUrl.query,
      href,
    },
    routeMatch,
    segments
  )
  const mw = await runRouteMiddleware({
    to: mwTo,
    from: null,
    context: requestContext,
    request,
    match: routeMatch,
  })
  if (mw.type === "redirect") {
    return { type: "redirect", path: toPathname(toMiddlewareRedirect(mw.to).path) }
  }
  if (mw.type === "abort") return { type: "abort" }
  if (mw.type === "error") {
    return {
      kind: "error",
      status: mw.status,
      body: mw.body,
      headers: mergeResponseHeaders(undefined),
    }
  }
  return { type: "continue" }
}

export async function buildPreparedAppForMatch(
  routeMatch: RouteMatch,
  requestUrl: RequestUrlState,
  pathPolicy: RouterPathPolicy,
  manifest: RouteManifest,
  ctx: RenderRequestContext | undefined,
  request: Request | undefined,
  locale: string | null,
  i18n: InternationalizationConfig<readonly string[], unknown> | undefined,
  renderOpts: { enableStreamingLoad?: boolean }
): Promise<PreparedApp | PrepareRedirect | null> {
  const requestContext = (ctx?.context ?? {}) as CustomRequestContext
  const i18nMessagesPromise =
    i18n && locale ? loadI18nMessages(i18n, locale) : Promise.resolve(undefined)

  const [searchCheck, tree] = await Promise.all([
    validateSearchForMatch(routeMatch, requestUrl.query, {
      hash: requestUrl.hash,
    }),
    loadRouteTree(routeMatch),
  ])
  if (!searchCheck.ok) {
    if (searchCheck.failure.kind === "redirect") {
      return { kind: "redirect", location: searchCheck.failure.location }
    }
    return null
  }

  const renderSignal = loaderSignalFromRequest(request)
  throwIfAborted(renderSignal)

  await ensureResolvedRouteLayersForMatch(routeMatch)

  const loaderCtx = buildLoaderContext({
    params: searchCheck.params,
    pathname: routeMatch.pathname,
    search: requestUrl.search,
    hash: requestUrl.hash,
    query: requestUrl.query,
    validatedQuery: searchCheck.validatedQuery,
    context: requestContext,
    meta: mergeRouteMeta(routeMatch),
    routeId: routeMatch.route.id,
    request,
    signal: renderSignal,
    ...loaderI18nFields(i18n, locale),
  })

  const { layoutModules, routeModule: rawRouteModule } = tree
  throwIfAborted(renderSignal)

  const pageMod = rawRouteModule

  const ssrPrepared = await resolveSsrRouteModule({
    pageMod,
    routeModule: rawRouteModule,
    loaderCtx,
    enableStreamingLoad: renderOpts.enableStreamingLoad,
    routeId: routeMatch.route.id,
  })
  if (ssrPrepared.discarded) return null
  throwIfAborted(renderSignal)

  const { routeModule, pageProps, streamPageLoad } = ssrPrepared

  const [streamHeadMeta, i18nMessages] = await Promise.all([
    resolveStreamHeadMeta(
      routeMatch,
      pageMod,
      loaderCtx,
      streamPageLoad ? undefined : (pageProps as PageProps<KiruLoader<unknown>>)
    ),
    i18nMessagesPromise,
  ])
  throwIfAborted(renderSignal)

  const i18nPayload: HydratedI18nPayload | undefined =
    i18n && locale && i18nMessages !== undefined
      ? {
          locale,
          data: i18nMessages,
          locales: i18n.locales,
          defaultLocale: i18n.defaultLocale,
        }
      : undefined
  const localeRouting =
    i18n && locale ? getI18nLocaleRouting(i18n) : undefined

  const app = buildAppElement(
    routeMatch.pathname,
    routeMatch.params,
    layoutModules,
    routeModule,
    manifest,
    requestContext,
    pageProps as LeafRouteProps,
    { url: requestUrl, pathPolicy, i18n: i18nPayload, localeRouting }
  )

  const responseStatus = 200
  const responseHeaders = mergeResponseHeaders(
    ctx?.headers,
    cachePolicyToHeaders(
      undefined,
      routeMatch.route.static === true,
      getISRRevalidate(readRouteISRExport(pageMod))
    )
  )

  return {
    app,
    routeMatch,
    requestContext,
    serializedPageData: streamPageLoad
      ? undefined
      : serializedDataFromPageProps(pageProps),
    streamHeadMeta,
    pagePropsPromise: undefined,
    earlyFlushHead: streamPageLoad,
    i18nPayload,
    responseStatus,
    responseHeaders,
  }
}

export function matchRouteForPath(
  manifest: RouteManifest,
  path: string,
  pathPolicy: RouterPathPolicy,
  limits?: import("./requestLimits.js").ResolvedRequestLimits
): RouteMatch | null {
  return matchRoute(manifest, path, pathPolicy, limits)
}

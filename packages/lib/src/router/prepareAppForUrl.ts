import { matchRoute } from "./manifest.js"
import {
  formatPathname,
  pathnameForMatch,
  resolvePathPolicy,
} from "./pathPolicy.js"
import { parseRequestUrl, toPathname } from "./requestUrl.js"
import {
  detectLocaleFromRequest,
  formatPublicPathname,
  getI18nLocaleRouting,
  loaderI18nFields,
  loadI18nMessages,
  resolveInvalidLocaleRedirect,
  shouldRejectInvalidLocale,
  shouldRunLocaleDetection,
  splitAppPathnameDetailed,
  type InternationalizationConfig,
} from "./i18n/index.js"
import type { HydratedI18nPayload } from "./i18nContext.js"
import {
  buildMatchSegments,
  buildMiddlewareTo,
} from "./navigation.js"
import { mergeRouteMeta } from "./routeMeta.js"
import {
  runRouteMiddleware,
  toMiddlewareRedirect,
} from "./routeMiddleware.js"
import type {
  CustomRequestContext,
  RouteHeadMeta,
  RouteManifest,
  RouteMatch,
  RouteMiddleware,
} from "./types.js"
import { loadNotFoundRouteTree, loadRouteTree } from "./routeTree.js"
import type { LeafRouteProps } from "./routeTree.js"
import { buildLoaderContext } from "./runPageLoad.js"
import { loaderSignalFromRequest, throwIfAborted } from "./navigationScope.js"
import type { KiruLoader, PageProps } from "./loaders.js"
import {
  isAsyncPageHead,
  readPageHeadExport,
  createDynamicHeadContext,
  resolveMergedRoutePageHead,
  resolveMergedRoutePageHeadSync,
} from "./pageHead.js"
import { validateSearchForMatch } from "./validateSearchForMatch.js"
import { resolveSsrRouteModule } from "./prepareRoute.js"
import {
  cachePolicyToHeaders,
  mergeResponseHeaders,
  readRouteCacheExport,
  readRouteHeadersExport,
  readRouteStatusExport,
  resolveRouteStatus,
} from "./routeResponse.js"
import { getISRRevalidate, readRouteISRExport } from "./routeRevalidate.js"
import { serializedDataFromPageProps } from "./rendererStream.js"
import { buildAppElement } from "./ssrAppBuild.js"

export interface RenderRequestContext {
  headers?: HeadersInit
  method?: string
  context?: CustomRequestContext
}

export const DEFAULT_SSR_HEADERS: Record<string, string> = {
  "content-type": "text/html; charset=utf-8",
}

export type PreparedApp = {
  app: JSX.Element
  routeMatch: RouteMatch | null
  requestContext: CustomRequestContext
  serializedPageData?: unknown
  streamHeadMeta?: RouteHeadMeta
  pagePropsPromise?: Promise<Record<string, unknown>>
  earlyFlushHead?: boolean
  i18nPayload?: HydratedI18nPayload
  responseStatus: number
  responseHeaders: Record<string, string>
}

export type PrepareRedirect = {
  kind: "redirect"
  location: string
  headers?: Record<string, string>
}

export type PrepareError = {
  kind: "error"
  status: number
  body?: string
  headers?: Record<string, string>
}

export type PrepareAppResult =
  | PreparedApp
  | PrepareRedirect
  | PrepareError
  | null

export function isPrepareRedirect(
  p: Exclude<PrepareAppResult, null>
): p is PrepareRedirect {
  return "kind" in p && p.kind === "redirect"
}

export function isPrepareError(
  p: Exclude<PrepareAppResult, null>
): p is PrepareError {
  return "kind" in p && p.kind === "error"
}

const MAX_SSR_MIDDLEWARE_REDIRECTS = 16

export async function resolveStreamHeadMeta(
  match: RouteMatch,
  pageMod: unknown,
  loaderCtx: ReturnType<typeof buildLoaderContext>,
  pageProps?: PageProps<KiruLoader<unknown>>
): Promise<RouteHeadMeta> {
  const pageHead = readPageHeadExport(pageMod)
  const headCtx = createDynamicHeadContext(loaderCtx, pageMod, pageProps)
  return isAsyncPageHead(pageHead)
    ? resolveMergedRoutePageHead(match.route.head, pageHead, headCtx)
    : resolveMergedRoutePageHeadSync(match.route.head, pageHead, headCtx)
}

function localePreferenceCookie(
  config: InternationalizationConfig<readonly string[], unknown>,
  locale: string
): string {
  return `${config.localeCookie}=${encodeURIComponent(locale)}; Path=/; Max-Age=31536000; SameSite=Lax`
}

export function tryLocaleDetectionRedirect(
  rawPath: string,
  request: Request | undefined,
  i18n: InternationalizationConfig<readonly string[], unknown>,
  pathPolicy: ReturnType<typeof resolvePathPolicy>
): { location: string; headers: Record<string, string> } | null {
  if (!request || !shouldRunLocaleDetection(rawPath, i18n)) return null
  const localeRouting = getI18nLocaleRouting(i18n)
  const detected = detectLocaleFromRequest(request, i18n)
  const target = formatPublicPathname("/", detected, localeRouting, pathPolicy)
  const current = formatPathname(rawPath, pathPolicy)
  if (target === current) return null
  return {
    location: target,
    headers: { "set-cookie": localePreferenceCookie(i18n, detected) },
  }
}

export function localeDetectionRedirectRenderHit(
  location: string,
  extraHeaders: Record<string, string>,
  stream: boolean
) {
  const redirectHeaders = {
    ...DEFAULT_SSR_HEADERS,
    location,
    ...extraHeaders,
  }
  if (stream) {
    return {
      kind: "stream" as const,
      result: {
        status: 302,
        headers: redirectHeaders,
        body: new ReadableStream<string>({
          start(controller) {
            controller.close()
          },
        }),
      },
    }
  }
  return {
    kind: "string" as const,
    result: {
      status: 302,
      headers: redirectHeaders,
      body: "",
    },
  }
}

export async function prepareAppForUrl(
  url: string,
  ctx: RenderRequestContext | undefined,
  manifest: RouteManifest,
  pathPolicy: ReturnType<typeof resolvePathPolicy>,
  i18n?: InternationalizationConfig<readonly string[], unknown>,
  request?: Request,
  globalMiddleware: RouteMiddleware[] = [],
  renderOpts: { enableStreamingLoad?: boolean } = {}
): Promise<PrepareAppResult> {
  const requestUrl = parseRequestUrl(url)
  const rawPath = pathnameForMatch(toPathname(url), pathPolicy)

  const localeRedirect =
    i18n && tryLocaleDetectionRedirect(rawPath, request, i18n, pathPolicy)
  if (localeRedirect) {
    return {
      kind: "redirect",
      location: localeRedirect.location,
      headers: localeRedirect.headers,
    }
  }

  let locale: string | null = null
  let logicalPath = rawPath
  if (i18n) {
    const localeRouting = getI18nLocaleRouting(i18n)
    const split = splitAppPathnameDetailed(rawPath, localeRouting)
    if (split.kind === "invalid-locale") {
      if (shouldRejectInvalidLocale(localeRouting)) {
        logicalPath = split.pathname
        locale = split.locale
      } else {
        const location = resolveInvalidLocaleRedirect(
          split,
          localeRouting,
          pathPolicy
        )
        return { kind: "redirect", location }
      }
    } else {
      logicalPath = split.pathname
      locale = split.locale
    }
  }
  const requestedPathname = formatPathname(logicalPath, pathPolicy)
  let path = requestedPathname

  for (let depth = 0; depth < MAX_SSR_MIDDLEWARE_REDIRECTS; depth++) {
    const routeMatch = matchRoute(manifest, path, pathPolicy)

    if (!routeMatch) {
      if (path === requestedPathname) {
        const notFoundTree = await loadNotFoundRouteTree(
          manifest,
          requestedPathname
        )
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
      return null
    }

    const requestContext = (ctx?.context ?? {}) as CustomRequestContext
    const href = `${path}${requestUrl.search}${requestUrl.hash}`
    const segments = buildMatchSegments(routeMatch)
    const mwTo = buildMiddlewareTo(
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
      meta: mergeRouteMeta(routeMatch),
      context: requestContext,
      request,
      globalMiddleware,
      match: routeMatch,
    })
    if (mw.type === "redirect") {
      path = toPathname(toMiddlewareRedirect(mw.to).path)
      continue
    }
    if (mw.type === "abort") return null
    if (mw.type === "error") {
      return {
        kind: "error",
        status: mw.status,
        body: mw.body,
        headers: mergeResponseHeaders(ctx?.headers),
      }
    }

    if (path !== requestedPathname) {
      return { kind: "redirect", location: path }
    }

    const searchCheck = await validateSearchForMatch(routeMatch, requestUrl.query, {
      hash: requestUrl.hash,
    })
    if (!searchCheck.ok) {
      if (searchCheck.failure.kind === "redirect") {
        return { kind: "redirect", location: searchCheck.failure.location }
      }
      return null
    }

    const renderSignal = loaderSignalFromRequest(request)
    throwIfAborted(renderSignal)

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

    const { layoutModules, routeModule: rawRouteModule } =
      await loadRouteTree(routeMatch)
    throwIfAborted(renderSignal)

    const pageMod = rawRouteModule
    const pageHead = readPageHeadExport(pageMod)
    const asyncHead = isAsyncPageHead(pageHead)

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

    const i18nMessagesPromise =
      i18n && locale ? loadI18nMessages(i18n, locale) : Promise.resolve(undefined)

    const [streamHeadMeta, i18nMessages] = await Promise.all([
      resolveStreamHeadMeta(
        routeMatch,
        pageMod,
        loaderCtx,
        streamPageLoad
          ? undefined
          : (pageProps as PageProps<KiruLoader<unknown>>)
      ),
      i18nMessagesPromise,
    ])
    throwIfAborted(renderSignal)

    const i18nPayload =
      i18n && locale && i18nMessages !== undefined
        ? {
            locale,
            data: i18nMessages,
            locales: i18n.locales,
            defaultLocale: i18n.default,
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

    const pagePropsForMeta =
      asyncHead || !streamPageLoad
        ? (pageProps as PageProps<KiruLoader<unknown>>)
        : undefined
    const resolvedStatus = resolveRouteStatus(
      readRouteStatusExport(pageMod),
      loaderCtx,
      pagePropsForMeta
    )
    const responseStatus = resolvedStatus ?? 200
    const routeHeadersExport = readRouteHeadersExport(pageMod)
    const responseHeaders = mergeResponseHeaders(
      ctx?.headers,
      cachePolicyToHeaders(
        readRouteCacheExport(pageMod),
        routeMatch.route.static === true,
        getISRRevalidate(readRouteISRExport(pageMod))
      ),
      routeHeadersExport?.resolve(loaderCtx, pagePropsForMeta)
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

  return null
}

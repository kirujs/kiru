import { pathnameForMatch, resolvePathPolicy } from "./pathPolicy.js"
import { parseRequestUrl, toPathname } from "./requestUrl.js"
import { mergeResponseHeaders } from "./routeResponse.js"
import type { InternationalizationConfig } from "./i18n/index.js"
import {
  resolveRequestLocale,
  tryLocaleDetectionRedirect,
} from "./prepareAppLocale.js"
import {
  buildPreparedAppForMatch,
  matchRouteForPath,
  prepareNotFoundApp,
  runMiddlewareForPath,
} from "./prepareAppMatch.js"
import {
  MAX_SSR_MIDDLEWARE_REDIRECTS,
  type PrepareAppResult,
  type RenderRequestContext,
} from "./prepareAppTypes.js"
import type { RouteManifest } from "./types.js"

export type {
  PrepareAppResult,
  PreparedApp,
  PrepareRedirect,
  PrepareError,
  RenderRequestContext,
} from "./prepareAppTypes.js"
export {
  DEFAULT_SSR_HEADERS,
  isPrepareRedirect,
  isPrepareError,
} from "./prepareAppTypes.js"
export { resolveStreamHeadMeta, localeDetectionRedirectRenderHit } from "./prepareAppHead.js"
export { tryLocaleDetectionRedirect } from "./prepareAppLocale.js"

export async function prepareAppForUrl(
  url: string,
  ctx: RenderRequestContext | undefined,
  manifest: RouteManifest,
  pathPolicy: ReturnType<typeof resolvePathPolicy>,
  i18n?: InternationalizationConfig<readonly string[], unknown>,
  request?: Request,
  renderOpts: {
    enableStreamingLoad?: boolean
    requestLimits?: import("./requestLimits.js").ResolvedRequestLimits
  } = {}
): Promise<PrepareAppResult> {
  const requestUrl = parseRequestUrl(
    url,
    "http://localhost",
    renderOpts.requestLimits
  )
  const rawPath = pathnameForMatch(toPathname(url), pathPolicy)

  const localeRedirect =
    i18n &&
    tryLocaleDetectionRedirect(rawPath, request, i18n, pathPolicy, url)
  if (localeRedirect) {
    return {
      kind: "redirect",
      location: localeRedirect.location,
      headers: localeRedirect.headers,
    }
  }

  const localeResolved = resolveRequestLocale(url, pathPolicy, i18n)
  if ("kind" in localeResolved) {
    return localeResolved
  }

  const { requestedPathname, locale } = localeResolved
  let path = requestedPathname

  for (let depth = 0; depth < MAX_SSR_MIDDLEWARE_REDIRECTS; depth++) {
    const routeMatch = matchRouteForPath(
      manifest,
      path,
      pathPolicy,
      renderOpts.requestLimits
    )

    if (!routeMatch) {
      if (path === requestedPathname) {
        return prepareNotFoundApp(
          manifest,
          requestedPathname,
          requestUrl,
          pathPolicy,
          ctx
        )
      }
      return null
    }

    const requestContext = (ctx?.context ?? {}) as import("./types.js").CustomRequestContext
    const mw = await runMiddlewareForPath(
      routeMatch,
      path,
      requestUrl,
      requestContext,
      request
    )
    if ("kind" in mw) {
      return {
        ...mw,
        headers: mergeResponseHeaders(ctx?.headers, mw.headers),
      }
    }
    if (mw.type === "redirect") {
      path = mw.path
      continue
    }
    if (mw.type === "abort") return null

    if (path !== requestedPathname) {
      return { kind: "redirect", location: path }
    }

    return buildPreparedAppForMatch(
      routeMatch,
      requestUrl,
      pathPolicy,
      manifest,
      ctx,
      request,
      locale,
      i18n,
      renderOpts
    )
  }

  return null
}

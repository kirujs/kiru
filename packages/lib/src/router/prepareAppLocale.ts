import {
  detectLocaleFromRequest,
  getI18nLocaleRouting,
  localeHomeUrl,
  resolveInvalidLocaleRedirect,
  shouldRejectInvalidLocale,
  shouldRunLocaleDetection,
  splitAppPathnameDetailed,
  type InternationalizationConfig,
} from "./i18n/index.js"
import { formatPathname, pathnameForMatch, resolvePathPolicy } from "./pathPolicy.js"
import { toPathname } from "./requestUrl.js"
import type { PrepareRedirect } from "./prepareAppTypes.js"

export function localePreferenceCookie(
  config: InternationalizationConfig<readonly string[], unknown>,
  locale: string
): string {
  return `${config.localeCookie}=${encodeURIComponent(locale)}; Path=/; Max-Age=31536000; SameSite=Lax`
}

export function tryLocaleDetectionRedirect(
  rawPath: string,
  request: Request | undefined,
  i18n: InternationalizationConfig<readonly string[], unknown>,
  pathPolicy: ReturnType<typeof resolvePathPolicy>,
  requestUrl?: string
): { location: string; headers: Record<string, string> } | null {
  if (!request || !shouldRunLocaleDetection(rawPath, i18n)) return null
  const localeRouting = getI18nLocaleRouting(i18n)
  const detected = detectLocaleFromRequest(request, i18n)
  const parsed = requestUrl ? new URL(requestUrl) : new URL(request.url)
  const target = localeHomeUrl("/", detected, localeRouting, {
    protocol: parsed.protocol,
    baseUrl: pathPolicy.baseUrl,
    pathPolicy,
  })
  const currentPath = formatPathname(rawPath, pathPolicy)
  const current =
    parsed.origin && target.startsWith("http")
      ? `${parsed.origin}${currentPath}`
      : currentPath
  if (target === current || target === `${parsed.origin}${currentPath}`) {
    return null
  }
  return {
    location: target,
    headers: { "set-cookie": localePreferenceCookie(i18n, detected) },
  }
}

export type ResolvedRequestLocale = {
  requestedPathname: string
  locale: string | null
}

/** Strip locale prefix and apply path policy before route matching. */
export function resolveRequestLocale(
  url: string,
  pathPolicy: ReturnType<typeof resolvePathPolicy>,
  i18n?: InternationalizationConfig<readonly string[], unknown>
): ResolvedRequestLocale | PrepareRedirect {
  const parsedUrl = new URL(url, "http://localhost")
  const rawPath = pathnameForMatch(toPathname(url), pathPolicy)
  let locale: string | null = null
  let logicalPath = rawPath

  if (!i18n) {
    return { requestedPathname: formatPathname(logicalPath, pathPolicy), locale }
  }

  const localeRouting = getI18nLocaleRouting(i18n)
  const split = splitAppPathnameDetailed(rawPath, localeRouting, {
    host: parsedUrl.host,
    protocol: parsedUrl.protocol,
    baseUrl: pathPolicy.baseUrl,
  })

  if (split.kind === "wrong-domain") {
    return { kind: "redirect", location: split.location }
  }

  if (split.kind === "invalid-locale") {
    if (shouldRejectInvalidLocale(localeRouting)) {
      logicalPath = split.pathname
      locale = split.locale
    } else {
      const location = resolveInvalidLocaleRedirect(split, localeRouting, pathPolicy, {
        host: parsedUrl.host,
        protocol: parsedUrl.protocol,
        baseUrl: pathPolicy.baseUrl,
      })
      return { kind: "redirect", location }
    }
  } else {
    logicalPath = split.pathname
    locale = split.locale
  }

  return {
    requestedPathname: formatPathname(logicalPath, pathPolicy),
    locale,
  }
}

import {
  resolveLocaleForPrerenderRequest,
  type I18nLocaleRouting,
} from "./i18n/index.js"
import { prerenderStorageKey } from "./i18n/routing.js"
import { resolvePathPolicy, type RouterPathPolicy } from "./pathPolicy.js"

export type PrerenderCacheKeyResolution = {
  cacheKey: string
  pathname: string
  locale?: string
}

/** Canonical prerender cache index key for a request URL. */
export function resolvePrerenderCacheKey(
  parsed: URL,
  options: {
    pathPolicy?: RouterPathPolicy
    localeRouting?: I18nLocaleRouting
  }
): PrerenderCacheKeyResolution {
  const pathPolicy = resolvePathPolicy(options.pathPolicy)
  const pathname = parsed.pathname
  const localeRouting = options.localeRouting
  if (!localeRouting?.domains.length) {
    return { cacheKey: pathname, pathname }
  }
  const resolved = resolveLocaleForPrerenderRequest(
    parsed.host,
    pathname,
    localeRouting,
    pathPolicy
  )
  if (!resolved) {
    return { cacheKey: pathname, pathname }
  }
  return {
    cacheKey: resolved.storageKey,
    pathname,
    locale: resolved.locale,
  }
}

export { prerenderStorageKey }

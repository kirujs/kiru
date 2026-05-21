import { addLocale, type I18nLocaleRouting } from "./localeRouting.js"
import { matchDomainEntry } from "./domains.js"
import { formatPathname, type RouterPathPolicy } from "../pathPolicy.js"
import {
  localePublicPath,
  prerenderStorageKey,
  splitAppPathnameDetailed,
} from "./routing.js"

export type PrerenderTarget = {
  locale: string
  logicalPath: string
  publicPath: string
  storageKey: string
  /** Filesystem path under clientDir (unique when public paths collide across domains). */
  diskPath: string
}

function prerenderDiskPath(
  locale: string,
  publicPath: string,
  routing: I18nLocaleRouting
): string {
  if (!routing.domains.length) return publicPath
  if (!routing.localeDomain.has(locale)) return publicPath
  if (publicPath === "/") return `/.kiru-i18n/${locale}`
  return `/.kiru-i18n/${locale}${publicPath}`
}

/**
 * Expand logical route paths into public URL paths for each configured locale.
 * Used for SSG prerender lists and disk cache keys.
 */
export function expandPathsForLocales(
  logicalPaths: readonly string[],
  routing: I18nLocaleRouting,
  pathPolicy?: RouterPathPolicy
): string[] {
  return expandPrerenderTargets(logicalPaths, routing, pathPolicy).map(
    (t) => t.publicPath
  )
}

/**
 * Per-locale prerender targets with distinct storage keys when public paths collide across hosts.
 */
export function expandPrerenderTargets(
  logicalPaths: readonly string[],
  routing: I18nLocaleRouting,
  pathPolicy?: RouterPathPolicy
): PrerenderTarget[] {
  const out: PrerenderTarget[] = []
  const seen = new Set<string>()

  for (const logical of logicalPaths) {
    for (const locale of routing.prefixes) {
      const binding = routing.localeDomain.get(locale)
      const host = binding?.host
      const publicPath = formatPathname(
        addLocale(logical, locale, routing, host),
        pathPolicy
      )
      const storageKey = prerenderStorageKey(locale, publicPath)
      if (seen.has(storageKey)) continue
      seen.add(storageKey)
      out.push({
        locale,
        logicalPath: logical,
        publicPath,
        storageKey,
        diskPath: prerenderDiskPath(locale, publicPath, routing),
      })
    }
  }

  return out.sort((a, b) =>
    a.storageKey.localeCompare(b.storageKey)
  )
}

/** Resolve active locale from host + public pathname for prerender disk lookup. */
export function resolveLocaleForPrerenderRequest(
  host: string | null | undefined,
  pathname: string,
  routing: I18nLocaleRouting,
  pathPolicy?: RouterPathPolicy
): { locale: string; storageKey: string } | null {
  const normalized = formatPathname(pathname, pathPolicy)
  const split = splitAppPathnameDetailed(normalized, routing, { host })
  if (split.kind === "wrong-domain" || split.kind === "invalid-locale") {
    return null
  }
  const publicPath = localePublicPath(
    split.pathname,
    split.locale,
    routing,
    host ?? routing.localeDomain.get(split.locale)?.host,
    pathPolicy
  )
  return {
    locale: split.locale,
    storageKey: prerenderStorageKey(split.locale, publicPath),
  }
}

/** @internal Used by expandPrerenderTargets for domain default paths */
export { matchDomainEntry }

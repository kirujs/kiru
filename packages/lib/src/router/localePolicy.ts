/**
 * Locale prefix helpers for i18n routing.
 *
 * @see docs/router/tier-3-wave-1.md#i18n
 */

import { normalizePathname } from "./pathPolicy.js"

export type LocalePrefixPolicy = "as-needed" | "always" | "never"

export type InvalidLocalePolicy = "redirect" | "not-found"

/** Site-level locale configuration from {@link defineSiteConfig}. */
export type SiteLocales = {
  /** Default locale code (e.g. `en`). */
  default: string
  /** URL prefix segments (e.g. `['en', 'fr']`). */
  prefixes: string[]
  /** When to add a locale prefix to public URLs. Default `as-needed`. */
  localePrefix?: LocalePrefixPolicy
  /** How to handle unsupported locale-like path segments. Default `redirect`. */
  invalidLocale?: InvalidLocalePolicy
}

const DEFAULT_LOCALE_PREFIX: LocalePrefixPolicy = "as-needed"

export function resolveLocalePrefixPolicy(
  locales?: SiteLocales
): LocalePrefixPolicy {
  return locales?.localePrefix ?? DEFAULT_LOCALE_PREFIX
}

export function resolveInvalidLocalePolicy(
  locales?: SiteLocales
): InvalidLocalePolicy {
  return locales?.invalidLocale ?? "redirect"
}

export function normalizeSiteLocales(locales: SiteLocales): SiteLocales {
  const prefixes = [...new Set(locales.prefixes.map((p) => p.replace(/^\/+|\/+$/g, "")))]
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)
  if (!prefixes.includes(locales.default)) {
    prefixes.unshift(locales.default)
  }
  return {
    default: locales.default,
    prefixes,
    localePrefix: locales.localePrefix ?? DEFAULT_LOCALE_PREFIX,
    invalidLocale: locales.invalidLocale ?? "redirect",
  }
}

/** BCP47-like segment: `en`, `fr`, `nl-BE`. */
export function isLocaleLikeSegment(segment: string): boolean {
  return /^[a-z]{2}(-[A-Za-z]{2})?$/i.test(segment)
}

export function shouldPrefixLocale(locale: string, locales?: SiteLocales): boolean {
  if (!locales) return false
  const loc = locale.replace(/^\/+|\/+$/g, "")
  if (!loc) return false
  const policy = resolveLocalePrefixPolicy(locales)
  if (policy === "never") return false
  if (policy === "always") return true
  return loc !== locales.default
}

/**
 * Strip leading locale segment from a pathname (after baseUrl is removed).
 * @see docs/router/tier-3-wave-1.md#i18n
 */
export function stripLocale(
  pathname: string,
  locales?: SiteLocales
): { locale: string | null; pathname: string } {
  if (!locales) {
    return { locale: null, pathname: normalizePathname(pathname) }
  }
  const normalized = normalizePathname(pathname)
  const segments = normalized === "/" ? [] : normalized.slice(1).split("/")
  const first = segments[0]
  if (first && locales.prefixes.includes(first)) {
    const rest = segments.slice(1)
    return {
      locale: first,
      pathname: rest.length ? `/${rest.join("/")}` : "/",
    }
  }
  return { locale: locales.default, pathname: normalized }
}

/**
 * Prepend locale segment to an app pathname when {@link shouldPrefixLocale} allows.
 * @see docs/router/tier-3-wave-1.md#i18n
 */
export function addLocale(
  pathname: string,
  locale: string,
  locales?: SiteLocales
): string {
  const normalized = normalizePathname(pathname)
  if (!locales || !shouldPrefixLocale(locale, locales)) return normalized
  const loc = locale.replace(/^\/+|\/+$/g, "")
  if (!loc) return normalized
  if (normalized === "/") return `/${loc}`
  return `/${loc}${normalized}`
}

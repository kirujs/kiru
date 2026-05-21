/**
 * Normalized locale URL routing derived from {@link InternationalizationConfig}.
 * Use {@link getI18nLocaleRouting} at i18n boundaries; pass `I18nLocaleRouting` to path helpers.
 */

import { normalizePathname } from "../pathPolicy.js"
import {
  buildLocaleDomainMap,
  matchDomainEntry,
  pathOnlyLocales,
  type LocaleDomainBinding,
  type NormalizedDomainEntry,
} from "./domains.js"

export { buildLocaleDomainMap, pathOnlyLocales } from "./domains.js"
import type { InternationalizationConfig } from "./createI18nConfig.js"

export type LocalePrefixPolicy = "as-needed" | "always" | "never"

export type InvalidLocalePolicy = "redirect" | "not-found"

/** URL routing slice normalized from `createI18nConfig` / {@link getI18nLocaleRouting}. */
export type I18nLocaleRouting = {
  defaultLocale: string
  /** Locale codes used as URL prefix segments (from `i18n.locales`). */
  prefixes: string[]
  localePrefix: LocalePrefixPolicy
  invalidLocale: InvalidLocalePolicy
  domains: NormalizedDomainEntry[]
  localeDomain: Map<string, LocaleDomainBinding>
  pathOnlyLocales: string[]
}

const DEFAULT_LOCALE_PREFIX: LocalePrefixPolicy = "as-needed"

export function resolveLocalePrefixPolicy(
  routing?: I18nLocaleRouting
): LocalePrefixPolicy {
  return routing?.localePrefix ?? DEFAULT_LOCALE_PREFIX
}

export function resolveInvalidLocalePolicy(
  routing?: I18nLocaleRouting
): InvalidLocalePolicy {
  return routing?.invalidLocale ?? "redirect"
}

export function normalizeI18nLocaleRouting(
  routing: I18nLocaleRouting
): I18nLocaleRouting {
  const prefixes = [
    ...new Set(routing.prefixes.map((p) => p.replace(/^\/+|\/+$/g, ""))),
  ]
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)
  if (!prefixes.includes(routing.defaultLocale)) {
    prefixes.unshift(routing.defaultLocale)
  }
  return {
    ...routing,
    prefixes,
    localePrefix: routing.localePrefix ?? DEFAULT_LOCALE_PREFIX,
    invalidLocale: routing.invalidLocale ?? "redirect",
  }
}

export function getI18nLocaleRouting(
  config: InternationalizationConfig<readonly string[], unknown>
): I18nLocaleRouting {
  const localeDomain = buildLocaleDomainMap(config.domains)
  return normalizeI18nLocaleRouting({
    defaultLocale: config.defaultLocale,
    prefixes: [...config.locales],
    localePrefix: config.localePrefix,
    invalidLocale: config.invalidLocale,
    domains: config.domains,
    localeDomain,
    pathOnlyLocales: pathOnlyLocales(config.locales, localeDomain),
  })
}

export function isLocaleLikeSegment(segment: string): boolean {
  return /^[a-z]{2}(-[A-Za-z]{2})?$/i.test(segment)
}

/**
 * Whether `locale` should get a path prefix for the current host / routing policy.
 */
export function shouldPrefixLocale(
  locale: string,
  routing?: I18nLocaleRouting,
  host?: string | null
): boolean {
  if (!routing) return false
  const loc = locale.replace(/^\/+|\/+$/g, "")
  if (!loc) return false

  if (host && routing.domains.length) {
    const entry = matchDomainEntry(host, routing.domains)
    if (entry) {
      const binding = routing.localeDomain.get(loc)
      if (binding && binding.host === entry.domain) {
        return !binding.isDefaultOnDomain
      }
    }
  } else if (routing.localeDomain.has(loc)) {
    const binding = routing.localeDomain.get(loc)!
    if (binding.isDefaultOnDomain) return false
    return true
  }

  if (!routing.pathOnlyLocales.includes(loc)) {
    const binding = routing.localeDomain.get(loc)
    if (binding?.isDefaultOnDomain) return false
    if (binding) return true
  }

  const policy = resolveLocalePrefixPolicy(routing)
  if (policy === "never") return false
  if (policy === "always") return true
  return loc !== routing.defaultLocale
}

export function stripLocale(
  pathname: string,
  routing?: I18nLocaleRouting
): { locale: string | null; pathname: string } {
  if (!routing) {
    return { locale: null, pathname: normalizePathname(pathname) }
  }
  const normalized = normalizePathname(pathname)
  const segments = normalized === "/" ? [] : normalized.slice(1).split("/")
  const first = segments[0]
  if (first && routing.prefixes.includes(first)) {
    const rest = segments.slice(1)
    return {
      locale: first,
      pathname: rest.length ? `/${rest.join("/")}` : "/",
    }
  }
  return { locale: routing.defaultLocale, pathname: normalized }
}

export function addLocale(
  pathname: string,
  locale: string,
  routing?: I18nLocaleRouting,
  host?: string | null
): string {
  const normalized = normalizePathname(pathname)
  if (!routing || !shouldPrefixLocale(locale, routing, host)) return normalized
  const loc = locale.replace(/^\/+|\/+$/g, "")
  if (!loc) return normalized
  if (normalized === "/") return `/${loc}`
  return `/${loc}${normalized}`
}

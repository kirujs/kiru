/**
 * Normalized locale URL routing derived from {@link InternationalizationConfig}.
 * Use {@link getI18nLocaleRouting} at i18n boundaries; pass `I18nLocaleRouting` to path helpers.
 */

import { normalizePathname } from "../pathPolicy.js"
import type { InternationalizationConfig } from "./createI18nConfig.js"

export type LocalePrefixPolicy = "as-needed" | "always" | "never"

export type InvalidLocalePolicy = "redirect" | "not-found"

/** URL routing slice normalized from `createI18nConfig` / {@link getI18nLocaleRouting}. */
export type I18nLocaleRouting = {
  default: string
  /** Locale codes used as URL prefix segments (from `i18n.locales`). */
  prefixes: string[]
  localePrefix: LocalePrefixPolicy
  invalidLocale: InvalidLocalePolicy
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
  if (!prefixes.includes(routing.default)) {
    prefixes.unshift(routing.default)
  }
  return {
    default: routing.default,
    prefixes,
    localePrefix: routing.localePrefix ?? DEFAULT_LOCALE_PREFIX,
    invalidLocale: routing.invalidLocale ?? "redirect",
  }
}

export function getI18nLocaleRouting(
  config: InternationalizationConfig<readonly string[], unknown>
): I18nLocaleRouting {
  return normalizeI18nLocaleRouting({
    default: config.default,
    prefixes: [...config.locales],
    localePrefix: config.localePrefix,
    invalidLocale: config.invalidLocale,
  })
}

export function isLocaleLikeSegment(segment: string): boolean {
  return /^[a-z]{2}(-[A-Za-z]{2})?$/i.test(segment)
}

export function shouldPrefixLocale(
  locale: string,
  routing?: I18nLocaleRouting
): boolean {
  if (!routing) return false
  const loc = locale.replace(/^\/+|\/+$/g, "")
  if (!loc) return false
  const policy = resolveLocalePrefixPolicy(routing)
  if (policy === "never") return false
  if (policy === "always") return true
  return loc !== routing.default
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
  return { locale: routing.default, pathname: normalized }
}

export function addLocale(
  pathname: string,
  locale: string,
  routing?: I18nLocaleRouting
): string {
  const normalized = normalizePathname(pathname)
  if (!routing || !shouldPrefixLocale(locale, routing)) return normalized
  const loc = locale.replace(/^\/+|\/+$/g, "")
  if (!loc) return normalized
  if (normalized === "/") return `/${loc}`
  return `/${loc}${normalized}`
}

import {
  addLocale,
  isLocaleLikeSegment,
  resolveInvalidLocalePolicy,
  stripLocale,
  type SiteLocales,
} from "../localePolicy.js"
import {
  addBase,
  formatPathname,
  normalizePathname,
  pathnameForMatch,
  stripBase,
  type RouterPathPolicy,
} from "../pathPolicy.js"
import { parseQuery, type RouterQuery } from "../requestUrl.js"

export type AppPathSplit = {
  locale: string
  /** Path without locale prefix (for route matching). */
  pathname: string
}

export type AppPathSplitResult =
  | ({ kind: "ok" } & AppPathSplit)
  | {
      kind: "invalid-locale"
      segment: string
      /** Logical pathname after removing the invalid locale segment. */
      pathname: string
      locale: string
    }

export function splitAppPathname(
  pathname: string,
  locales: SiteLocales
): AppPathSplit {
  const result = splitAppPathnameDetailed(pathname, locales)
  if (result.kind === "invalid-locale") {
    return { locale: result.locale, pathname: result.pathname }
  }
  return { locale: result.locale, pathname: result.pathname }
}

export function splitAppPathnameDetailed(
  pathname: string,
  locales: SiteLocales
): AppPathSplitResult {
  const normalized = pathnameForMatch(pathname)
  const segments = normalized === "/" ? [] : normalized.slice(1).split("/")
  const first = segments[0]

  if (first && locales.prefixes.includes(first)) {
    const rest = segments.slice(1)
    return {
      kind: "ok",
      locale: first,
      pathname: rest.length ? `/${rest.join("/")}` : "/",
    }
  }

  if (
    first &&
    isLocaleLikeSegment(first) &&
    !locales.prefixes.includes(first)
  ) {
    const rest = segments.slice(1)
    return {
      kind: "invalid-locale",
      segment: first,
      pathname: rest.length ? `/${rest.join("/")}` : "/",
      locale: locales.default,
    }
  }

  const { locale, pathname: logical } = stripLocale(normalized, locales)
  const resolved =
    locale && locales.prefixes.includes(locale) ? locale : locales.default
  return { kind: "ok", locale: resolved, pathname: logical }
}

export function formatPublicPathname(
  logicalPath: string,
  locale: string,
  locales: SiteLocales,
  policy?: RouterPathPolicy
): string {
  return formatPathname(addLocale(logicalPath, locale, locales), policy)
}

export function formatPublicHref(
  logicalPath: string,
  locale: string,
  locales: SiteLocales,
  policy: RouterPathPolicy | undefined,
  baseUrl: string,
  search: string,
  hash: string
): string {
  const publicPath = formatPublicPathname(logicalPath, locale, locales, policy)
  return `${addBase(publicPath, baseUrl)}${search}${hash}`
}

export function resolveInvalidLocaleRedirect(
  split: Extract<AppPathSplitResult, { kind: "invalid-locale" }>,
  locales: SiteLocales,
  pathPolicy?: RouterPathPolicy
): string {
  return formatPublicPathname(split.pathname, split.locale, locales, pathPolicy)
}

export function shouldRejectInvalidLocale(locales: SiteLocales): boolean {
  return resolveInvalidLocalePolicy(locales) === "not-found"
}

/** Strip a leading locale segment from `to` when href is already localized. */
export function stripLocalePrefixFromPath(
  pathname: string,
  locales: SiteLocales
): string {
  const normalized = normalizePathname(pathname)
  const segments = normalized === "/" ? [] : normalized.slice(1).split("/")
  const first = segments[0]
  if (
    first &&
    (locales.prefixes.includes(first) || isLocaleLikeSegment(first))
  ) {
    const rest = segments.slice(1)
    return rest.length ? `/${rest.join("/")}` : "/"
  }
  return normalized
}

export function parseAppLocation(
  url: URL,
  baseUrl: string,
  locales?: SiteLocales,
  policy?: RouterPathPolicy
): {
  pathname: string
  locale: string | null
  hash: string
  query: RouterQuery
  href: string
  invalidLocale?: Extract<AppPathSplitResult, { kind: "invalid-locale" }>
} {
  const rawPath = stripBase(url.pathname, baseUrl)
  const search = url.search
  const hash = url.hash
  if (!locales) {
    const pathname = pathnameForMatch(url.pathname, policy)
    return {
      pathname,
      locale: null,
      hash,
      query: parseQuery(search),
      href: `${addBase(pathname, baseUrl)}${search}${hash}`,
    }
  }
  const detailed = splitAppPathnameDetailed(rawPath, locales)
  if (detailed.kind === "invalid-locale") {
    const redirectPath = resolveInvalidLocaleRedirect(detailed, locales, policy)
    return {
      pathname: detailed.pathname,
      locale: detailed.locale,
      hash,
      query: parseQuery(search),
      href: `${addBase(redirectPath, baseUrl)}${search}${hash}`,
      invalidLocale: detailed,
    }
  }
  return {
    pathname: detailed.pathname,
    locale: detailed.locale,
    hash,
    query: parseQuery(search),
    href: formatPublicHref(
      detailed.pathname,
      detailed.locale,
      locales,
      policy,
      baseUrl,
      search,
      hash
    ),
  }
}

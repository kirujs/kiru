import {
  addLocale,
  isLocaleLikeSegment,
  resolveInvalidLocalePolicy,
  stripLocale,
  type I18nLocaleRouting,
} from "./localeRouting.js"
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
  routing: I18nLocaleRouting
): AppPathSplit {
  const result = splitAppPathnameDetailed(pathname, routing)
  if (result.kind === "invalid-locale") {
    return { locale: result.locale, pathname: result.pathname }
  }
  return { locale: result.locale, pathname: result.pathname }
}

export function splitAppPathnameDetailed(
  pathname: string,
  routing: I18nLocaleRouting
): AppPathSplitResult {
  const normalized = pathnameForMatch(pathname)
  const segments = normalized === "/" ? [] : normalized.slice(1).split("/")
  const first = segments[0]

  if (first && routing.prefixes.includes(first)) {
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
    !routing.prefixes.includes(first)
  ) {
    const rest = segments.slice(1)
    return {
      kind: "invalid-locale",
      segment: first,
      pathname: rest.length ? `/${rest.join("/")}` : "/",
      locale: routing.default,
    }
  }

  const { locale, pathname: logical } = stripLocale(normalized, routing)
  const resolved =
    locale && routing.prefixes.includes(locale) ? locale : routing.default
  return { kind: "ok", locale: resolved, pathname: logical }
}

export function formatPublicPathname(
  logicalPath: string,
  locale: string,
  routing: I18nLocaleRouting,
  policy?: RouterPathPolicy
): string {
  return formatPathname(addLocale(logicalPath, locale, routing), policy)
}

export function formatPublicHref(
  logicalPath: string,
  locale: string,
  routing: I18nLocaleRouting,
  policy: RouterPathPolicy | undefined,
  baseUrl: string,
  search: string,
  hash: string
): string {
  const publicPath = formatPublicPathname(logicalPath, locale, routing, policy)
  return `${addBase(publicPath, baseUrl)}${search}${hash}`
}

export function resolveInvalidLocaleRedirect(
  split: Extract<AppPathSplitResult, { kind: "invalid-locale" }>,
  routing: I18nLocaleRouting,
  pathPolicy?: RouterPathPolicy
): string {
  return formatPublicPathname(split.pathname, split.locale, routing, pathPolicy)
}

export function shouldRejectInvalidLocale(routing: I18nLocaleRouting): boolean {
  return resolveInvalidLocalePolicy(routing) === "not-found"
}

/** Strip a leading locale segment from `to` when href is already localized. */
export function stripLocalePrefixFromPath(
  pathname: string,
  routing: I18nLocaleRouting
): string {
  const normalized = normalizePathname(pathname)
  const segments = normalized === "/" ? [] : normalized.slice(1).split("/")
  const first = segments[0]
  if (
    first &&
    (routing.prefixes.includes(first) || isLocaleLikeSegment(first))
  ) {
    const rest = segments.slice(1)
    return rest.length ? `/${rest.join("/")}` : "/"
  }
  return normalized
}

export function parseAppLocation(
  url: URL,
  baseUrl: string,
  routing?: I18nLocaleRouting,
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
  if (!routing) {
    const pathname = pathnameForMatch(url.pathname, policy)
    return {
      pathname,
      locale: null,
      hash,
      query: parseQuery(search),
      href: `${addBase(pathname, baseUrl)}${search}${hash}`,
    }
  }
  const detailed = splitAppPathnameDetailed(rawPath, routing)
  if (detailed.kind === "invalid-locale") {
    const redirectPath = resolveInvalidLocaleRedirect(detailed, routing, policy)
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
      routing,
      policy,
      baseUrl,
      search,
      hash
    ),
  }
}

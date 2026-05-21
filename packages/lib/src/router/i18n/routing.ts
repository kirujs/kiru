import {
  addLocale,
  isLocaleLikeSegment,
  resolveInvalidLocalePolicy,
  stripLocale,
  type I18nLocaleRouting,
} from "./localeRouting.js"
import {
  localeOrigin,
  localeOwnsHost,
  matchDomainEntry,
  resolveProtocolForBinding,
} from "./domains.js"
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
  | {
      kind: "wrong-domain"
      locale: string
      pathname: string
      location: string
    }

export type SplitAppPathnameOptions = {
  host?: string | null
  protocol?: string
  baseUrl?: string
}

function resolveLocaleFromHost(
  host: string | null | undefined,
  routing: I18nLocaleRouting
): string | null {
  if (!host || !routing.domains.length) return null
  const entry = matchDomainEntry(host, routing.domains)
  return entry?.defaultLocale ?? null
}

export function localePublicPath(
  logicalPath: string,
  locale: string,
  routing: I18nLocaleRouting,
  host?: string | null,
  policy?: RouterPathPolicy
): string {
  const targetHost =
    host ?? routing.localeDomain.get(locale)?.host ?? null
  return formatPathname(
    addLocale(logicalPath, locale, routing, targetHost),
    policy
  )
}

export function localeHomeUrl(
  logicalPath: string,
  locale: string,
  routing: I18nLocaleRouting,
  opts?: {
    protocol?: string
    baseUrl?: string
    pathPolicy?: RouterPathPolicy
    search?: string
    hash?: string
  }
): string {
  const binding = routing.localeDomain.get(locale)
  const protocol = resolveProtocolForBinding(binding, opts?.protocol)
  const publicPath = localePublicPath(
    logicalPath,
    locale,
    routing,
    binding?.host,
    opts?.pathPolicy
  )
  const search = opts?.search ?? ""
  const hash = opts?.hash ?? ""

  if (binding) {
    const origin = localeOrigin(binding, protocol)
    return `${origin}${publicPath}${search}${hash}`
  }

  const base = opts?.baseUrl ?? ""
  return `${addBase(publicPath, base)}${search}${hash}`
}

export function wrongDomainRedirect(
  locale: string,
  logicalPath: string,
  routing: I18nLocaleRouting,
  opts?: SplitAppPathnameOptions & {
    pathPolicy?: RouterPathPolicy
    search?: string
    hash?: string
  }
): string | null {
  const binding = routing.localeDomain.get(locale)
  if (!binding) return null
  if (localeOwnsHost(locale, opts?.host, routing.localeDomain, routing.domains)) {
    return null
  }
  return localeHomeUrl(logicalPath, locale, routing, {
    protocol: opts?.protocol,
    baseUrl: opts?.baseUrl,
    pathPolicy: opts?.pathPolicy,
    search: opts?.search,
    hash: opts?.hash,
  })
}

export function splitAppPathname(
  pathname: string,
  routing: I18nLocaleRouting,
  opts?: SplitAppPathnameOptions
): AppPathSplit {
  const result = splitAppPathnameDetailed(pathname, routing, opts)
  if (result.kind === "invalid-locale") {
    return { locale: result.locale, pathname: result.pathname }
  }
  if (result.kind === "wrong-domain") {
    return { locale: result.locale, pathname: result.pathname }
  }
  return { locale: result.locale, pathname: result.pathname }
}

export function splitAppPathnameDetailed(
  pathname: string,
  routing: I18nLocaleRouting,
  opts?: SplitAppPathnameOptions
): AppPathSplitResult {
  const normalized = pathnameForMatch(pathname)
  const segments = normalized === "/" ? [] : normalized.slice(1).split("/")
  const first = segments[0]
  const host = opts?.host

  const domainDefault = resolveLocaleFromHost(host, routing)

  if (first && routing.prefixes.includes(first)) {
    const rest = segments.slice(1)
    const logical = rest.length ? `/${rest.join("/")}` : "/"
    const redirect = wrongDomainRedirect(first, logical, routing, opts)
    if (redirect) {
      return {
        kind: "wrong-domain",
        locale: first,
        pathname: logical,
        location: redirect,
      }
    }
    return {
      kind: "ok",
      locale: first,
      pathname: logical,
    }
  }

  if (
    first &&
    isLocaleLikeSegment(first) &&
    !routing.prefixes.includes(first)
  ) {
    const rest = segments.slice(1)
    const logical = rest.length ? `/${rest.join("/")}` : "/"
    const redirect = wrongDomainRedirect(first, logical, routing, opts)
    if (redirect) {
      return {
        kind: "wrong-domain",
        locale: first,
        pathname: logical,
        location: redirect,
      }
    }
    return {
      kind: "invalid-locale",
      segment: first,
      pathname: logical,
      locale: routing.defaultLocale,
    }
  }

  if (domainDefault) {
    return {
      kind: "ok",
      locale: domainDefault,
      pathname: normalized,
    }
  }

  const { locale, pathname: logical } = stripLocale(normalized, routing)
  const resolved =
    locale && routing.prefixes.includes(locale) ? locale : routing.defaultLocale
  return { kind: "ok", locale: resolved, pathname: logical }
}

export function formatPublicPathname(
  logicalPath: string,
  locale: string,
  routing: I18nLocaleRouting,
  policy?: RouterPathPolicy,
  host?: string | null
): string {
  return localePublicPath(logicalPath, locale, routing, host, policy)
}

export function formatPublicHref(
  logicalPath: string,
  locale: string,
  routing: I18nLocaleRouting,
  policy: RouterPathPolicy | undefined,
  baseUrl: string,
  search: string,
  hash: string,
  opts?: {
    host?: string | null
    protocol?: string
    /** When set, skip cross-domain absolute URLs (e.g. prerender). */
    sameOriginOnly?: boolean
  }
): string {
  const currentHost = opts?.host ?? null
  const binding = routing.localeDomain.get(locale)
  const publicPath = localePublicPath(
    logicalPath,
    locale,
    routing,
    binding?.host ?? currentHost,
    policy
  )

  if (
    !opts?.sameOriginOnly &&
    binding &&
    currentHost &&
    !localeOwnsHost(locale, currentHost, routing.localeDomain, routing.domains)
  ) {
    const protocol = resolveProtocolForBinding(binding, opts?.protocol)
    return `${localeOrigin(binding, protocol)}${publicPath}${search}${hash}`
  }

  if (!opts?.sameOriginOnly && binding && !currentHost) {
    const protocol = resolveProtocolForBinding(binding, opts?.protocol)
    return `${localeOrigin(binding, protocol)}${publicPath}${search}${hash}`
  }

  return `${addBase(publicPath, baseUrl)}${search}${hash}`
}

export function resolveInvalidLocaleRedirect(
  split: Extract<AppPathSplitResult, { kind: "invalid-locale" }>,
  routing: I18nLocaleRouting,
  pathPolicy?: RouterPathPolicy,
  opts?: SplitAppPathnameOptions
): string {
  const redirect = wrongDomainRedirect(
    split.segment,
    split.pathname,
    routing,
    { ...opts, pathPolicy }
  )
  if (redirect) return redirect
  return formatPublicPathname(
    split.pathname,
    split.locale,
    routing,
    pathPolicy,
    opts?.host
  )
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
  wrongDomain?: Extract<AppPathSplitResult, { kind: "wrong-domain" }>
} {
  const rawPath = stripBase(url.pathname, baseUrl)
  const search = url.search
  const hash = url.hash
  const host = url.host
  const protocol = url.protocol

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

  const detailed = splitAppPathnameDetailed(rawPath, routing, {
    host,
    protocol,
    baseUrl,
  })

  if (detailed.kind === "wrong-domain") {
    return {
      pathname: detailed.pathname,
      locale: detailed.locale,
      hash,
      query: parseQuery(search),
      href: detailed.location,
      wrongDomain: detailed,
    }
  }

  if (detailed.kind === "invalid-locale") {
    const redirectPath = resolveInvalidLocaleRedirect(detailed, routing, policy, {
      host,
      protocol,
      baseUrl,
    })
    return {
      pathname: detailed.pathname,
      locale: detailed.locale,
      hash,
      query: parseQuery(search),
      href: redirectPath.startsWith("http")
        ? `${redirectPath}${search}${hash}`
        : `${addBase(redirectPath, baseUrl)}${search}${hash}`,
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
      hash,
      { host, protocol }
    ),
  }
}

export function prerenderStorageKey(locale: string, publicPath: string): string {
  return `${locale}::${publicPath}`
}

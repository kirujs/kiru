export type I18nDomainInput = {
  domain: string
  defaultLocale: string
  locales?: readonly string[]
  http?: boolean
}

export type NormalizedDomainEntry = {
  domain: string
  defaultLocale: string
  /** All locale codes served on this host (default + optional locales[]). */
  locales: string[]
  http?: boolean
}

export type LocaleDomainBinding = {
  host: string
  isDefaultOnDomain: boolean
  http?: boolean
}

export function normalizeDomainHost(domain: string): string {
  const trimmed = domain.trim().toLowerCase()
  if (trimmed.includes("://") || trimmed.includes("/")) {
    throw new Error(
      `createI18nConfig: domains[].domain must be a hostname without scheme or path, got "${domain}"`
    )
  }
  return trimmed
}

export function normalizeRequestHost(host: string): string {
  return host.trim().toLowerCase()
}

/** Match request host to a domain entry (exact + apex www.). */
export function matchDomainEntry(
  host: string,
  domains: readonly NormalizedDomainEntry[]
): NormalizedDomainEntry | null {
  const normalized = normalizeRequestHost(host)
  for (const entry of domains) {
    const domain = entry.domain
    if (normalized === domain) return entry
    if (
      !domain.startsWith("www.") &&
      normalized === `www.${domain}`
    ) {
      return entry
    }
  }
  return null
}

export function validateI18nDomains(config: {
  locales: readonly string[]
  defaultLocale: string
  domains?: readonly I18nDomainInput[]
}): NormalizedDomainEntry[] {
  const domains = config.domains
  if (!domains?.length) return []

  const seenDomains = new Set<string>()
  const localeOwner = new Map<string, string>()

  const out: NormalizedDomainEntry[] = []

  for (const raw of domains) {
    const domain = normalizeDomainHost(raw.domain)
    if (seenDomains.has(domain)) {
      throw new Error(
        `createI18nConfig: duplicate domains[].domain "${raw.domain}"`
      )
    }
    seenDomains.add(domain)

    if (!config.locales.includes(raw.defaultLocale)) {
      throw new Error(
        `createI18nConfig: domains[].defaultLocale "${raw.defaultLocale}" is not in locales`
      )
    }

    const extra = raw.locales ?? []
    if (extra.includes(raw.defaultLocale)) {
      throw new Error(
        `createI18nConfig: domains[].locales must not include defaultLocale "${raw.defaultLocale}" for domain "${raw.domain}"`
      )
    }

    for (const loc of extra) {
      if (!config.locales.includes(loc)) {
        throw new Error(
          `createI18nConfig: domains[].locales entry "${loc}" is not in locales`
        )
      }
    }

    const allOnDomain = [raw.defaultLocale, ...extra]
    for (const loc of allOnDomain) {
      const prev = localeOwner.get(loc)
      if (prev) {
        throw new Error(
          `createI18nConfig: locale "${loc}" is assigned to both "${prev}" and "${raw.domain}"`
        )
      }
      localeOwner.set(loc, raw.domain)
    }

    out.push({
      domain,
      defaultLocale: raw.defaultLocale,
      locales: allOnDomain,
      http: raw.http,
    })
  }

  return out
}

export function buildLocaleDomainMap(
  domains: readonly NormalizedDomainEntry[]
): Map<string, LocaleDomainBinding> {
  const map = new Map<string, LocaleDomainBinding>()
  for (const entry of domains) {
    for (const locale of entry.locales) {
      map.set(locale, {
        host: entry.domain,
        isDefaultOnDomain: locale === entry.defaultLocale,
        http: entry.http,
      })
    }
  }
  return map
}

export function pathOnlyLocales(
  allLocales: readonly string[],
  localeDomain: Map<string, LocaleDomainBinding>
): string[] {
  return allLocales.filter((loc) => !localeDomain.has(loc))
}

export function localeOrigin(
  binding: LocaleDomainBinding,
  protocol: "http:" | "https:" = "https:"
): string {
  return `${protocol}//${binding.host}`
}

export function resolveProtocolForBinding(
  binding: LocaleDomainBinding | undefined,
  requestProtocol?: string
): "http:" | "https:" {
  if (binding?.http) return "http:"
  if (requestProtocol === "http:" || requestProtocol === "http") return "http:"
  return "https:"
}

export function localeOwnsHost(
  locale: string,
  host: string | null | undefined,
  localeDomain: Map<string, LocaleDomainBinding>,
  domains: readonly NormalizedDomainEntry[]
): boolean {
  if (!host) return false
  const binding = localeDomain.get(locale)
  if (!binding) return false
  const matched = matchDomainEntry(host, domains)
  if (!matched) return false
  return matched.domain === binding.host
}

import type { InternationalizationConfig } from "./createI18nConfig.js"

/**
 * Map an input locale tag to the nearest configured locale (exact → language → default).
 */
export function resolveLocale<
  Locales extends readonly string[],
  Data,
>(config: InternationalizationConfig<Locales, Data>, input: string): Locales[number] {
  const normalized = input.trim()
  if (!normalized) return config.defaultLocale

  if (config.locales.includes(normalized as Locales[number])) {
    return normalized as Locales[number]
  }

  const language = normalized.split("-")[0]?.toLowerCase()
  if (language) {
    const match = config.locales.find(
      (loc) =>
        loc === language ||
        loc.toLowerCase() === language ||
        loc.toLowerCase().startsWith(`${language}-`)
    )
    if (match) return match
  }

  return config.defaultLocale
}

function parseAcceptLanguage(header: string | null | undefined): string[] {
  if (!header) return []
  return header
    .split(",")
    .map((part) => {
      const [tag, qPart] = part.trim().split(";")
      const q = qPart?.startsWith("q=") ? Number.parseFloat(qPart.slice(2)) : 1
      return { tag: tag?.trim() ?? "", q: Number.isFinite(q) ? q : 0 }
    })
    .filter((entry) => entry.tag)
    .sort((a, b) => b.q - a.q)
    .map((entry) => entry.tag)
}

function readCookie(cookieHeader: string | null | undefined, name: string): string | null {
  if (!cookieHeader) return null
  const parts = cookieHeader.split(";")
  for (const part of parts) {
    const [key, ...rest] = part.trim().split("=")
    if (key === name) return decodeURIComponent(rest.join("="))
  }
  return null
}

export type DetectLocaleRequest = {
  headers: {
    get(name: string): string | null
  }
}

/**
 * Detect locale from preference cookie, then Accept-Language.
 */
export function detectLocaleFromRequest<
  Locales extends readonly string[],
  Data,
>(
  req: DetectLocaleRequest,
  config: InternationalizationConfig<Locales, Data>
): Locales[number] {
  const fromCookie = readCookie(
    req.headers.get("cookie"),
    config.localeCookie
  )
  if (fromCookie) {
    return resolveLocale(config, fromCookie)
  }

  for (const tag of parseAcceptLanguage(req.headers.get("accept-language"))) {
    const resolved = resolveLocale(config, tag)
    if (config.locales.includes(resolved)) return resolved
  }

  return config.defaultLocale
}

export function shouldRunLocaleDetection(
  pathname: string,
  config: InternationalizationConfig<readonly string[], unknown>
): boolean {
  if (!config.localeDetection) return false
  const normalized = pathname === "" ? "/" : pathname
  return config.detectPaths.some((p) => normalized === p)
}

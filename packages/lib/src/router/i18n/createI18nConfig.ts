import {
  normalizeSiteLocales,
  type InvalidLocalePolicy,
  type LocalePrefixPolicy,
  type SiteLocales,
} from "../localePolicy.js"

export type I18nRoutingOptions = {
  localePrefix?: LocalePrefixPolicy
  invalidLocale?: InvalidLocalePolicy
  localeDetection?: boolean
  localeCookie?: string
  detectPaths?: string[]
}

export type InternationalizationConfig<
  Locales extends readonly string[],
  Data,
> = {
  default: Locales[number]
  locales: Locales
  load: {
    [locale in Locales[number]]: () => Promise<{ default: Data }>
  }
  localePrefix: LocalePrefixPolicy
  invalidLocale: InvalidLocalePolicy
  localeDetection: boolean
  localeCookie: string
  detectPaths: readonly string[]
}

export type I18nOptions<Data, Locales extends readonly string[]> = {
  default: Locales[number]
  load: {
    [locale in Locales[number]]: () => Promise<{ default: Data }>
  }
}

const DEFAULT_ROUTING: Required<
  Pick<
    I18nRoutingOptions,
    "localePrefix" | "invalidLocale" | "localeDetection" | "localeCookie" | "detectPaths"
  >
> = {
  localePrefix: "as-needed",
  invalidLocale: "redirect",
  localeDetection: true,
  localeCookie: "KIRU_LOCALE",
  detectPaths: ["/"],
}

export function createI18nConfig<const Locales extends readonly string[]>(
  locales: Locales,
  routing: I18nRoutingOptions = {}
) {
  const resolvedRouting = { ...DEFAULT_ROUTING, ...routing }
  return <Data>(
    options: I18nOptions<Data, Locales>
  ): InternationalizationConfig<Locales, Data> => ({
    ...options,
    locales,
    localePrefix: resolvedRouting.localePrefix,
    invalidLocale: resolvedRouting.invalidLocale,
    localeDetection: resolvedRouting.localeDetection,
    localeCookie: resolvedRouting.localeCookie,
    detectPaths: resolvedRouting.detectPaths,
  })
}

export function i18nToSiteLocales(
  config: InternationalizationConfig<readonly string[], unknown>
): SiteLocales {
  return normalizeSiteLocales({
    default: config.default,
    prefixes: [...config.locales],
    localePrefix: config.localePrefix,
    invalidLocale: config.invalidLocale,
  })
}

export function loaderI18nFields(
  config: InternationalizationConfig<readonly string[], unknown> | undefined,
  locale: string | null | undefined
): {
  locale?: string
  locales?: readonly string[]
  defaultLocale?: string
} {
  if (!config || locale == null) return {}
  return {
    locale,
    locales: config.locales,
    defaultLocale: config.default,
  }
}

export async function loadI18nMessages<
  Locales extends readonly string[],
  Data,
>(config: InternationalizationConfig<Locales, Data>, locale: string): Promise<Data> {
  const { resolveLocale } = await import("./detect.js")
  const key = resolveLocale(config, locale)
  const mod = await config.load[key]()
  return mod.default
}

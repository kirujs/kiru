import {
  buildLocaleDomainMap,
  pathOnlyLocales,
  validateI18nDomains,
  type I18nDomainInput,
  type NormalizedDomainEntry,
} from "./domains.js"
import type {
  InvalidLocalePolicy,
  LocalePrefixPolicy,
} from "./localeRouting.js"

export type { I18nDomainInput, NormalizedDomainEntry }

const DEFAULT_ROUTING = {
  localePrefix: "as-needed" as LocalePrefixPolicy,
  invalidLocale: "redirect" as InvalidLocalePolicy,
  localeDetection: true,
  localeCookie: "KIRU_LOCALE",
  detectPaths: ["/"] as readonly string[],
}

export type InternationalizationConfig<
  Locales extends readonly string[],
  Data,
> = {
  defaultLocale: Locales[number]
  locales: Locales
  load: {
    [locale in Locales[number]]: () => Promise<Data>
  }
  localePrefix: LocalePrefixPolicy
  invalidLocale: InvalidLocalePolicy
  localeDetection: boolean
  localeCookie: string
  detectPaths: readonly string[]
  domains: NormalizedDomainEntry[]
}

export type CreateI18nConfigInput<
  TLocales extends readonly string[],
  TLoaders extends Record<TLocales[number], () => Promise<unknown>>,
> = {
  locales: TLocales
  defaultLocale: TLocales[number]
  localePrefix?: LocalePrefixPolicy
  invalidLocale?: InvalidLocalePolicy
  localeDetection?: boolean
  localeCookie?: string
  detectPaths?: readonly string[]
  domains?: readonly I18nDomainInput[]
  load: TLoaders
}

export function createI18nConfig<
  const TLocales extends readonly string[],
  TLoaders extends Record<TLocales[number], () => Promise<unknown>>,
>(
  config: CreateI18nConfigInput<TLocales, TLoaders>
): InternationalizationConfig<
  TLocales,
  Awaited<ReturnType<TLoaders[TLocales[number]]>>
> {
  if (!config.locales.includes(config.defaultLocale)) {
    throw new Error(
      `createI18nConfig: defaultLocale "${config.defaultLocale}" is not in locales`
    )
  }

  const domains = validateI18nDomains({
    locales: config.locales,
    defaultLocale: config.defaultLocale,
    domains: config.domains,
  })

  return {
    defaultLocale: config.defaultLocale,
    locales: config.locales,
    load: config.load as {
      [locale in TLocales[number]]: () => Promise<
        Awaited<ReturnType<TLoaders[TLocales[number]]>>
      >
    },
    localePrefix: config.localePrefix ?? DEFAULT_ROUTING.localePrefix,
    invalidLocale: config.invalidLocale ?? DEFAULT_ROUTING.invalidLocale,
    localeDetection:
      config.localeDetection ?? DEFAULT_ROUTING.localeDetection,
    localeCookie: config.localeCookie ?? DEFAULT_ROUTING.localeCookie,
    detectPaths: config.detectPaths ?? DEFAULT_ROUTING.detectPaths,
    domains,
  }
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
    defaultLocale: config.defaultLocale,
  }
}

export async function loadI18nMessages<
  Locales extends readonly string[],
  Data,
>(config: InternationalizationConfig<Locales, Data>, locale: string): Promise<Data> {
  const { resolveLocale } = await import("./detect.js")
  const key = resolveLocale(config, locale)
  return config.load[key]()
}

/** @internal Re-export for routing layer */
export { buildLocaleDomainMap, pathOnlyLocales }

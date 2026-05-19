import type { Internationalization, NavigationResult } from "../types.js"
import type { InternationalizationConfig } from "./createI18nConfig.js"

/** Resolved `Internationalization.config` from module augmentation, or `never`. */
export type AppI18nConfig = Internationalization extends { config: infer C }
  ? C
  : never

export type IsAppI18nConfigured = [AppI18nConfig] extends [never] ? false : true

export type AppI18nLocale = AppI18nConfig extends InternationalizationConfig<
  infer Locales,
  infer _Data
>
  ? Locales[number]
  : string

export type AppI18nLocales = AppI18nConfig extends InternationalizationConfig<
  infer Locales,
  infer _Data
>
  ? Locales
  : readonly string[]

export type AppI18nData = AppI18nConfig extends InternationalizationConfig<
  infer _Locales,
  infer Data
>
  ? Data extends Record<string, unknown>
    ? Data
    : Record<string, never>
  : Record<string, never>

/**
 * Locale segment for {@link Link}, `navigate`, and `resolveHref`.
 * `false` skips prefixing (for `to` that already includes a locale).
 */
export type RouterLocaleParam = IsAppI18nConfigured extends true
  ? AppI18nLocale | false
  : string | false

export type RouterNavigateOptions = {
  replace?: boolean
  transition?: boolean
  locale?: RouterLocaleParam
}

export type RouterI18nFields = IsAppI18nConfigured extends true
  ? {
      /** Active locale from `createRouter({ i18n })`. */
      locale: Kiru.Signal<AppI18nLocale>
      /** Switch locale on the current logical route (preserves query and hash). */
      setLocale: (
        nextLocale: AppI18nLocale,
        options?: { replace?: boolean }
      ) => Promise<NavigationResult>
      defaultLocale: AppI18nLocale
    }
  : {
      locale?: Kiru.Signal<string>
      setLocale?: (
        nextLocale: string,
        options?: { replace?: boolean }
      ) => Promise<NavigationResult>
      defaultLocale?: string
    }

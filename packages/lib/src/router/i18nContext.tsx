import { createContext, useContext } from "../context.js"
import { createElement } from "../element.js"
import { setup } from "../hooks/index.js"
import type { Signal } from "../signals/index.js"
import { signal } from "../signals/index.js"
import type { Internationalization } from "./types.js"
import type { InternationalizationConfig } from "./i18n/createI18nConfig.js"
import {
  createI18nTranslator,
  createReactiveI18nTranslator,
  type I18nTranslator,
} from "./i18n/translate.js"

type DefaultI18nConfig = Internationalization extends { config: infer C }
  ? C
  : never

type I18nData = DefaultI18nConfig extends InternationalizationConfig<
  infer _Locales,
  infer Data
>
  ? Data extends Record<string, unknown>
    ? Data
    : Record<string, never>
  : Record<string, never>

type I18nLocale = DefaultI18nConfig extends InternationalizationConfig<
  infer Locales,
  infer _Data
>
  ? Locales[number]
  : string

type I18nLocalesList = DefaultI18nConfig extends InternationalizationConfig<
  infer Locales,
  infer _Data
>
  ? Locales
  : readonly string[]

export type I18nContextValue = {
  /** On the client this is a {@link Signal} so `{locale}` in JSX stays reactive. */
  locale: I18nLocale | Signal<I18nLocale>
  /** Dot-path only: `t("home.greeting")`. */
  t: I18nTranslator<I18nData>
  locales: I18nLocalesList
  defaultLocale: I18nLocale
}

export type { I18nTranslator } from "./i18n/translate.js"

export type I18nRuntime = ReturnType<typeof createI18nRuntime<unknown>>

const I18nContext = createContext<I18nContextValue | null>(null)
const I18nRuntimeContext = createContext<I18nRuntime | null>(null)

export function I18nProvider({
  value,
  children,
}: {
  value: I18nContextValue
  children?: JSX.Children
}) {
  return createElement(I18nContext, { value, children })
}

function useOptionalI18nRuntime(): I18nRuntime | null {
  return useContext(I18nRuntimeContext)
}

/**
 * Type-safe translations from `declare module "kiru/router" { interface Internationalization { config: typeof i18n } }`.
 *
 * Safe to destructure: `const { locale, t } = useI18n()`. Use `t("dot.path")` for copy;
 * `locale` is a signal on the client and unwraps in JSX.
 */
export function useI18n(): I18nContextValue {
  const runtime = useOptionalI18nRuntime()
  if (runtime) {
    const { locales, defaultLocale } = runtime.value()
    return {
      locale: runtime.locale as Signal<I18nLocale>,
      t: createReactiveI18nTranslator(runtime.data as Signal<I18nData>),
      locales,
      defaultLocale,
    }
  }
  const ctx = useContext(I18nContext)
  if (!ctx) {
    throw new Error(
      "useI18n() requires I18nProvider (pass `i18n` to createRouter / createRenderer)"
    )
  }
  return ctx
}

export function useOptionalI18n(): I18nContextValue | null {
  const runtime = useOptionalI18nRuntime()
  if (runtime) {
    const { locales, defaultLocale } = runtime.value()
    return {
      locale: runtime.locale as Signal<I18nLocale>,
      t: createReactiveI18nTranslator(runtime.data as Signal<I18nData>),
      locales,
      defaultLocale,
    }
  }
  return useContext(I18nContext)
}

export type HydratedI18nPayload = {
  locale: string
  data: unknown
  locales?: readonly string[]
  defaultLocale?: string
}

export function serializeI18nScript(payload: HydratedI18nPayload): string {
  const json = JSON.stringify(payload)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029")
  return `<script type="application/json" k-i18n>${json}</script>`
}

export function readHydratedI18n(): HydratedI18nPayload | null {
  if (typeof document === "undefined") return null
  const el = document.querySelector("script[k-i18n]")
  if (!el) return null
  try {
    const parsed = JSON.parse(el.textContent || "{}") as HydratedI18nPayload
    el.remove()
    return parsed
  } catch {
    el.remove()
    return null
  }
}

/** Client shell: exposes {@link createI18nRuntime} to {@link useI18n}. */
export const I18nReactiveRoot: Kiru.Component<{
  runtime: I18nRuntime
  children?: JSX.Children
}> = () => {
  const $ = setup<typeof I18nReactiveRoot>()
  return () =>
    createElement(I18nRuntimeContext, {
      value: $.props.runtime,
      children: $.props.children,
    })
}

export function createI18nRuntime<Data>(options: {
  initialLocale: string
  initialData: Data
  locales: readonly string[]
  defaultLocale: string
}): {
  locale: Signal<string>
  data: Signal<Data>
  value: () => I18nContextValue
  setLocale: (locale: string, data: Data) => void
} {
  const locale = signal(options.initialLocale)
  const data = signal(options.initialData)
  const locales = options.locales
  const defaultLocale = options.defaultLocale
  return {
    locale,
    data,
    value: () => ({
      locale: locale.peek() as I18nLocale,
      t: createI18nTranslator(data.peek() as I18nData),
      locales: locales as I18nLocalesList,
      defaultLocale: defaultLocale as I18nLocale,
    }),
    setLocale(nextLocale, nextData) {
      locale.value = nextLocale
      data.value = nextData
    },
  }
}

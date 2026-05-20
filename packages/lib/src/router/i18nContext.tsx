import { createContext, useContext } from "../context.js"
import { createElement } from "../element.js"
import type { Signal } from "../signals/index.js"
import { signal } from "../signals/index.js"
import type { InternationalizationConfig } from "./i18n/index.js"
import { loadI18nMessages } from "./i18n/index.js"
import {
  createI18nTranslator,
  createReactiveI18nTranslator,
  hasLoadedI18nBundle,
  type I18nTranslator,
} from "./i18n/translate.js"
import type {
  AppI18nData,
  AppI18nLocale,
  AppI18nLocales,
} from "./i18n/augmentation.js"

type I18nData = AppI18nData
type I18nLocale = AppI18nLocale
type I18nLocalesList = AppI18nLocales

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

function i18nFromRuntime(runtime: I18nRuntime): I18nContextValue {
  const { locales, defaultLocale } = runtime.value()
  return {
    locale: runtime.locale as Signal<I18nLocale>,
    t: createReactiveI18nTranslator(runtime.data as Signal<I18nData>),
    locales,
    defaultLocale,
  }
}

/**
 * Type-safe translations from `declare module "kiru/router" { interface Internationalization { config: typeof i18n } }`.
 *
 * Safe to destructure: `const { locale, t } = useI18n()`. Use `t("dot.path")` for copy;
 * `locale` is a signal on the client and unwraps in JSX.
 */
export function useI18n(): I18nContextValue {
  const runtime = useContext(I18nRuntimeContext)
  if (runtime) return i18nFromRuntime(runtime)
  const ctx = useContext(I18nContext)
  if (!ctx) {
    throw new Error(
      "useI18n() requires I18nProvider (pass `i18n` to createRouter / createRenderer)"
    )
  }
  return ctx
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

/**
 * Loads the active locale bundle when the document has no `k-i18n` payload.
 * Call before {@link mount} or {@link hydrate} so `useI18n().t` never runs on an empty bundle.
 */
export async function ensureClientI18nReady(router: {
  __i18n?: {
    runtime: I18nRuntime
    config: InternationalizationConfig<readonly string[], unknown>
  }
  locale?: { peek(): string }
}): Promise<void> {
  const bag = router.__i18n
  if (!bag) return
  if (hasLoadedI18nBundle(bag.runtime.data.peek())) return
  const locale = router.locale?.peek() ?? bag.config.default
  const data = await loadI18nMessages(bag.config, locale)
  bag.runtime.setLocale(locale, data)
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
}> = ({ runtime, children }) =>
  createElement(I18nRuntimeContext, {
    value: runtime,
    children: children,
  })

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

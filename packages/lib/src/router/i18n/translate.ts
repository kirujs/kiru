import type { Signal } from "../../signals/index.js"

/** Leaf keys for nested message objects, e.g. `"home.greeting"`. */
export type DotPath<T> = T extends object
  ? {
      [K in keyof T & string]: T[K] extends string
        ? K
        : T[K] extends Record<string, unknown>
          ? `${K}.${DotPath<T[K]>}`
          : never
    }[keyof T & string]
  : never

export function hasLoadedI18nBundle(data: unknown): boolean {
  return (
    typeof data === "object" &&
    data !== null &&
    Object.keys(data as object).length > 0
  )
}

export function getByPath(root: unknown, path: string): unknown {
  if (!path) return root
  let cur: unknown = root
  for (const part of path.split(".")) {
    if (cur == null || typeof cur !== "object") return undefined
    cur = (cur as Record<string, unknown>)[part]
  }
  return cur
}

/** Dot-path translator: `t("home.greeting")` only (no `t.home` property access). */
export type I18nTranslator<Data extends Record<string, unknown>> = (
  key: DotPath<Data>
) => string

export function createI18nTranslator<Data extends Record<string, unknown>>(
  data: Data
): I18nTranslator<Data> {
  return (key: DotPath<Data>) => {
    const value = getByPath(data, key)
    if (typeof value !== "string") {
      throw new Error(
        `[kiru/i18n] Missing or non-string translation for "${key}"`
      )
    }
    return value
  }
}

/** Client `useI18n().t` — reads the latest bundle on each call and tracks `data`. */
export function createReactiveI18nTranslator<
  Data extends Record<string, unknown>,
>(data: Signal<Data>): I18nTranslator<Data> {
  return (key: DotPath<Data>) => {
    const value = getByPath(data.value, key)
    if (typeof value !== "string") {
      throw new Error(
        `[kiru/i18n] Missing or non-string translation for "${key}"`
      )
    }
    return value
  }
}

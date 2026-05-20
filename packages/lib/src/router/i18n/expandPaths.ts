import { addLocale, type I18nLocaleRouting } from "./localeRouting.js"
import { formatPathname, type RouterPathPolicy } from "../pathPolicy.js"

/**
 * Expand logical route paths into public URL paths for each configured locale.
 * Used for SSG prerender lists and disk cache keys.
 */
export function expandPathsForLocales(
  logicalPaths: readonly string[],
  routing: I18nLocaleRouting,
  pathPolicy?: RouterPathPolicy
): string[] {
  const out = new Set<string>()
  for (const logical of logicalPaths) {
    for (const prefix of routing.prefixes) {
      out.add(formatPathname(addLocale(logical, prefix, routing), pathPolicy))
    }
  }
  return Array.from(out).sort()
}

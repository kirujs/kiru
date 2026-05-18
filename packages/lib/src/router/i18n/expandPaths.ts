import { addLocale, type SiteLocales } from "../localePolicy.js"
import { formatPathname, type RouterPathPolicy } from "../pathPolicy.js"

/**
 * Expand logical route paths into public URL paths for each configured locale.
 * Used for SSG prerender lists and disk cache keys.
 */
export function expandPathsForLocales(
  logicalPaths: readonly string[],
  locales: SiteLocales,
  pathPolicy?: RouterPathPolicy
): string[] {
  const out = new Set<string>()
  for (const logical of logicalPaths) {
    for (const prefix of locales.prefixes) {
      out.add(formatPathname(addLocale(logical, prefix, locales), pathPolicy))
    }
  }
  return Array.from(out).sort()
}

export {
  createI18nConfig,
  loaderI18nFields,
  loadI18nMessages,
  type InternationalizationConfig,
  type CreateI18nConfigInput,
  type I18nDomainInput,
  type NormalizedDomainEntry,
} from "./createI18nConfig.js"
export {
  addLocale,
  getI18nLocaleRouting,
  isLocaleLikeSegment,
  normalizeI18nLocaleRouting,
  shouldPrefixLocale,
  stripLocale,
  type I18nLocaleRouting,
  type InvalidLocalePolicy,
  type LocalePrefixPolicy,
} from "./localeRouting.js"
export {
  buildLocaleDomainMap,
  localeOrigin,
  localeOwnsHost,
  matchDomainEntry,
  normalizeDomainHost,
  validateI18nDomains,
  type LocaleDomainBinding,
} from "./domains.js"
export type {
  AppI18nConfig,
  AppI18nData,
  AppI18nLocale,
  AppI18nLocales,
  IsAppI18nConfigured,
  RouterI18nFields,
  RouterLocaleParam,
  RouterNavigateOptions,
} from "./augmentation.js"
export {
  expandPathsForLocales,
  expandPrerenderTargets,
  resolveLocaleForPrerenderRequest,
  type PrerenderTarget,
} from "./expandPaths.js"
export {
  createI18nTranslator,
  getByPath,
  type DotPath,
  type I18nTranslator,
} from "./translate.js"
export {
  detectLocaleFromRequest,
  resolveLocale,
  shouldRunLocaleDetection,
  type DetectLocaleRequest,
} from "./detect.js"
export {
  formatPublicHref,
  formatPublicPathname,
  localeHomeUrl,
  localePublicPath,
  parseAppLocation,
  prerenderStorageKey,
  resolveInvalidLocaleRedirect,
  shouldRejectInvalidLocale,
  splitAppPathname,
  splitAppPathnameDetailed,
  stripLocalePrefixFromPath,
  wrongDomainRedirect,
  type AppPathSplit,
  type AppPathSplitResult,
  type SplitAppPathnameOptions,
} from "./routing.js"

export {
  createI18nConfig,
  loaderI18nFields,
  loadI18nMessages,
  type InternationalizationConfig,
  type I18nOptions,
  type I18nRoutingOptions,
} from "./createI18nConfig.js"
export {
  addLocale,
  getI18nLocaleRouting,
  isLocaleLikeSegment,
  normalizeI18nLocaleRouting,
  stripLocale,
  type I18nLocaleRouting,
  type InvalidLocalePolicy,
  type LocalePrefixPolicy,
} from "./localeRouting.js"
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
export { expandPathsForLocales } from "./expandPaths.js"
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
  parseAppLocation,
  resolveInvalidLocaleRedirect,
  shouldRejectInvalidLocale,
  splitAppPathname,
  splitAppPathnameDetailed,
  stripLocalePrefixFromPath,
  type AppPathSplit,
  type AppPathSplitResult,
} from "./routing.js"

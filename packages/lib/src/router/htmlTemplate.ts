import { __DEV__ } from "../env.js"
import { warnOnce } from "./devWarnings.dev.js"

export const LOCALE_TOKEN = "{{kiru_locale}}"
const HEAD_TOKEN = "{{kiru_head}}"
const BODY_TOKEN = "{{kiru_body}}"

export interface CompiledRouteHtmlTemplate {
  /** When true, `splitForStream().prefix` includes serialized head HTML. */
  readonly headBeforeBody: boolean
  readonly hasLocaleToken: boolean
  render: (body: string, headHtml: string, locale?: string) => string
  splitForStream: (
    headHtml: string,
    locale?: string
  ) => { prefix: string; suffix: string }
}

function applyLocaleToken(html: string, locale?: string): string {
  if (!html.includes(LOCALE_TOKEN)) return html
  return html.replaceAll(LOCALE_TOKEN, locale ?? "")
}

/** True when `<html>` has a fixed `lang="…"` instead of `lang="{{kiru_locale}}"`. */
export function templateHasStaticHtmlLang(template: string): boolean {
  return /<html\b[^>]*\slang="(?!{{kiru_locale}})[^"]*"/i.test(template)
}

export function templateUsesLocaleToken(template: string): boolean {
  return template.includes(LOCALE_TOKEN)
}

/**
 * Dev-only checks for `createRenderer({ i18n })` + `htmlTemplate` wiring.
 * @see docs/router/tier-3-wave-1.md#i18n
 */
export function validateRouteHtmlTemplate(
  template: string,
  options: { i18n?: boolean }
): void {
  const hasToken = templateUsesLocaleToken(template)
  const staticLang = templateHasStaticHtmlLang(template)

  if (!__DEV__) return

  if (options.i18n) {
    if (!hasToken) {
      warnOnce(
        "html-template-locale-token",
        `htmlTemplate is missing ${LOCALE_TOKEN}. Set document language with e.g. <html lang="${LOCALE_TOKEN}"> when using createRenderer({ i18n }).`
      )
    }
    if (staticLang) {
      warnOnce(
        "html-template-static-lang",
        `htmlTemplate uses a static <html lang="…"> attribute. Replace it with lang="${LOCALE_TOKEN}" so locale is applied per request.`
      )
    }
  } else if (hasToken) {
    warnOnce(
      "html-template-locale-token-unused",
      `${LOCALE_TOKEN} in htmlTemplate has no effect without createRenderer({ i18n }).`
    )
  }
}

/**
 * Compile tokenized HTML template once for repeated render use.
 *
 * All segment boundaries are resolved at compile time so that
 * render/splitForStream are pure string concatenation with no scanning.
 */
export function compileRouteHtmlTemplate(
  template: string
): CompiledRouteHtmlTemplate {
  const bodyIndex = template.indexOf(BODY_TOKEN)
  if (bodyIndex === -1) {
    throw new Error(
      `[kiru/router] compileRouteHtmlTemplate: template must include "${BODY_TOKEN}".`
    )
  }
  const headIndex = template.indexOf(HEAD_TOKEN)
  if (headIndex === -1) {
    throw new Error(
      `[kiru/router] compileRouteHtmlTemplate: template must include "${HEAD_TOKEN}".`
    )
  }

  const hasLocaleToken = templateUsesLocaleToken(template)

  if (headIndex < bodyIndex) {
    const s0 = template.slice(0, headIndex)
    const s1 = template.slice(headIndex + HEAD_TOKEN.length, bodyIndex)
    const s2 = template.slice(bodyIndex + BODY_TOKEN.length)
    return {
      headBeforeBody: true,
      hasLocaleToken,
      render: (body, headHtml, locale) =>
        applyLocaleToken(`${s0}${headHtml}${s1}${body}${s2}`, locale),
      splitForStream: (headHtml, locale) => ({
        prefix: applyLocaleToken(`${s0}${headHtml}${s1}`, locale),
        suffix: applyLocaleToken(s2, locale),
      }),
    }
  }

  const s0 = template.slice(0, bodyIndex)
  const s1 = template.slice(bodyIndex + BODY_TOKEN.length, headIndex)
  const s2 = template.slice(headIndex + HEAD_TOKEN.length)
  return {
    headBeforeBody: false,
    hasLocaleToken,
    render: (body, headHtml, locale) =>
      applyLocaleToken(`${s0}${body}${s1}${headHtml}${s2}`, locale),
    splitForStream: (headHtml, locale) => ({
      prefix: applyLocaleToken(s0, locale),
      suffix: applyLocaleToken(`${s1}${headHtml}${s2}`, locale),
    }),
  }
}

/**
 * Inject prerendered/SSR body and head fragments into an HTML template.
 * Placeholders: `{{kiru_head}}`, `{{kiru_body}}`, and optionally `{{kiru_locale}}`.
 */
export function fillRouteHtmlTemplate(
  template: string,
  options: { body: string; headHtml: string; locale?: string }
): string {
  return compileRouteHtmlTemplate(template).render(
    options.body,
    options.headHtml,
    options.locale
  )
}

export function renderCompiledTemplate(
  compiled: CompiledRouteHtmlTemplate,
  body: string,
  headHtml: string,
  locale?: string
): string {
  return compiled.render(body, headHtml, locale)
}

/**
 * Split template into pre-body and post-body segments for streaming.
 */
export function splitRouteHtmlTemplate(
  template: string,
  options: { headHtml: string; locale?: string }
): { prefix: string; suffix: string } {
  return compileRouteHtmlTemplate(template).splitForStream(
    options.headHtml,
    options.locale
  )
}

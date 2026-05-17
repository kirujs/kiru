const HEAD_TOKEN = "{{kiru_head}}"
const BODY_TOKEN = "{{kiru_body}}"

export interface CompiledRouteHtmlTemplate {
  /** When true, `splitForStream().prefix` includes serialized head HTML. */
  readonly headBeforeBody: boolean
  render: (body: string, headHtml: string) => string
  splitForStream: (headHtml: string) => { prefix: string; suffix: string }
}

/**
 * Compile tokenized HTML template once for repeated render use.
 *
 * All three segment boundaries are resolved at compile time so that
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

  if (headIndex < bodyIndex) {
    // Normal order: ...HEAD...BODY...
    const s0 = template.slice(0, headIndex)
    const s1 = template.slice(headIndex + HEAD_TOKEN.length, bodyIndex)
    const s2 = template.slice(bodyIndex + BODY_TOKEN.length)
    return {
      headBeforeBody: true,
      render: (body, headHtml) => `${s0}${headHtml}${s1}${body}${s2}`,
      splitForStream: (headHtml) => ({
        prefix: `${s0}${headHtml}${s1}`,
        suffix: s2,
      }),
    }
  } else {
    // Inverted order: ...BODY...HEAD... (uncommon but supported)
    const s0 = template.slice(0, bodyIndex)
    const s1 = template.slice(bodyIndex + BODY_TOKEN.length, headIndex)
    const s2 = template.slice(headIndex + HEAD_TOKEN.length)
    return {
      headBeforeBody: false,
      render: (body, headHtml) => `${s0}${body}${s1}${headHtml}${s2}`,
      splitForStream: (headHtml) => ({
        prefix: s0,
        suffix: `${s1}${headHtml}${s2}`,
      }),
    }
  }
}

/**
 * Inject prerendered/SSR body and head fragments into an HTML template.
 * Required placeholders: `{{kiru_head}}` and `{{kiru_body}}`.
 */
export function fillRouteHtmlTemplate(
  template: string,
  options: { body: string; headHtml: string }
): string {
  return compileRouteHtmlTemplate(template).render(
    options.body,
    options.headHtml
  )
}

/**
 * Split template into pre-body and post-body segments for streaming.
 */
export function splitRouteHtmlTemplate(
  template: string,
  options: { headHtml: string }
): { prefix: string; suffix: string } {
  return compileRouteHtmlTemplate(template).splitForStream(options.headHtml)
}

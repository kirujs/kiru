const HEAD_TOKEN = "{{kiru_head}}"
const BODY_TOKEN = "{{kiru_body}}"

export interface CompiledRouteHtmlTemplate {
  render: (body: string, headHtml: string) => string
  splitForStream: (headHtml: string) => { prefix: string; suffix: string }
}

/**
 * Compile tokenized HTML template once for repeated render use.
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
  const beforeBody = template.slice(0, bodyIndex)
  const afterBody = template.slice(bodyIndex + BODY_TOKEN.length)

  return {
    render(body, headHtml) {
      return `${replaceHead(beforeBody, headHtml)}${body}${replaceHead(
        afterBody,
        headHtml
      )}`
    },
    splitForStream(headHtml) {
      return {
        prefix: replaceHead(beforeBody, headHtml),
        suffix: replaceHead(afterBody, headHtml),
      }
    },
  }
}

function replaceHead(s: string, headHtml: string) {
  return s.split(HEAD_TOKEN).join(headHtml)
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

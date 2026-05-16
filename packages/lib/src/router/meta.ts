import {
  absoluteRouteUrl,
  formatPathname,
  type RouterPathPolicy,
} from "./pathPolicy.js"
import type { RouteHeadMeta } from "./types.js"

function mergeExtraMeta(
  base?: Array<Record<string, string>>,
  override?: Array<Record<string, string>>
): Array<Record<string, string>> | undefined {
  const merged = [...(base ?? []), ...(override ?? [])]
  if (!merged.length) return undefined
  const byKey = new Map<string, Record<string, string>>()
  for (const row of merged) {
    const key = row.name ?? row.property ?? row.httpEquiv ?? JSON.stringify(row)
    byKey.set(key, row)
  }
  return [...byKey.values()]
}

function mergeLinks(
  base?: Array<Record<string, string>>,
  override?: Array<Record<string, string>>
): Array<Record<string, string>> | undefined {
  const merged = [...(base ?? []), ...(override ?? [])]
  if (!merged.length) return undefined
  const byKey = new Map<string, Record<string, string>>()
  for (const row of merged) {
    const key = `${row.rel ?? ""}|${row.href ?? ""}|${row.as ?? ""}`
    byKey.set(key, row)
  }
  return [...byKey.values()]
}

function mergeJsonLd(
  base?: RouteHeadMeta["jsonLd"],
  override?: RouteHeadMeta["jsonLd"]
): RouteHeadMeta["jsonLd"] {
  if (!override) return base
  if (!base) return override
  const baseArr = Array.isArray(base) ? base : [base]
  const overrideArr = Array.isArray(override) ? override : [override]
  return [...baseArr, ...overrideArr]
}

export function mergeRouteHead(
  base: RouteHeadMeta,
  override?: RouteHeadMeta
): RouteHeadMeta {
  if (!override) {
    return {
      ...base,
      openGraph: base.openGraph ? { ...base.openGraph } : undefined,
      twitter: base.twitter ? { ...base.twitter } : undefined,
      extraMeta: base.extraMeta ? [...base.extraMeta] : undefined,
      links: base.links ? [...base.links] : undefined,
      jsonLd: base.jsonLd
        ? Array.isArray(base.jsonLd)
          ? [...base.jsonLd]
          : { ...base.jsonLd }
        : undefined,
    }
  }
  return {
    ...base,
    ...override,
    openGraph: { ...base.openGraph, ...override.openGraph },
    twitter: { ...base.twitter, ...override.twitter },
    extraMeta: mergeExtraMeta(base.extraMeta, override.extraMeta),
    links: mergeLinks(base.links, override.links),
    jsonLd: mergeJsonLd(base.jsonLd, override.jsonLd),
  }
}

function tpl(
  s: string | undefined,
  params: Record<string, string>
): string | undefined {
  if (s === undefined) return undefined
  return s.replace(/\{(\w+)\}/g, (_, k: string) => params[k] ?? "")
}

export function resolveMetaTemplates(
  head: RouteHeadMeta,
  params: Record<string, string>
): RouteHeadMeta {
  const og = head.openGraph
  const tw = head.twitter
  let title = tpl(head.title, params)
  if (title && head.titleTemplate) {
    title = head.titleTemplate.replace(/%s/g, title)
  }
  return {
    ...head,
    title,
    description: tpl(head.description, params),
    robots: tpl(head.robots, params),
    canonical: tpl(head.canonical, params),
    openGraph: og
      ? {
          title: tpl(og.title, params),
          description: tpl(og.description, params),
          image: tpl(og.image, params),
          url: tpl(og.url, params),
        }
      : undefined,
    twitter: tw
      ? {
          card: tpl(tw.card, params),
          title: tpl(tw.title, params),
          description: tpl(tw.description, params),
          image: tpl(tw.image, params),
        }
      : undefined,
    extraMeta: head.extraMeta?.map((row) => {
      const next: Record<string, string> = {}
      for (const [k, v] of Object.entries(row)) {
        next[k] = tpl(v, params) ?? ""
      }
      return next
    }),
  }
}

function escAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;")
}

function escText(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;")
}

function escJsonLdScript(json: string): string {
  return json.replace(/</g, "\\u003c")
}

/**
 * Returns HTML fragment for inside <head> (no <title> wrapper duplication if title empty).
 */
export function serializeDocumentHead(
  head: RouteHeadMeta,
  context?: {
    pathname?: string
    origin?: string
    pathPolicy?: RouterPathPolicy
  }
): string {
  const parts: string[] = []
  const pathname = formatPathname(context?.pathname ?? "/", context?.pathPolicy)
  const origin = context?.origin ?? ""
  const pathPolicy = context?.pathPolicy
  const abs = (url: string | undefined) => {
    if (!url) return undefined
    if (url.startsWith("http://") || url.startsWith("https://")) return url
    if (url.startsWith("/") && origin)
      return absoluteRouteUrl(origin, url, pathPolicy)
    return url
  }

  if (head.title) parts.push(`<title>${escText(head.title)}</title>`)
  if (head.description) {
    parts.push(
      `<meta name="description" content="${escAttr(head.description)}" />`
    )
  }
  if (head.robots) {
    parts.push(`<meta name="robots" content="${escAttr(head.robots)}" />`)
  }
  if (head.canonical) {
    const href = abs(head.canonical) ?? head.canonical
    parts.push(`<link rel="canonical" href="${escAttr(href)}" />`)
  }

  const og = head.openGraph
  if (og) {
    if (og.title)
      parts.push(`<meta property="og:title" content="${escAttr(og.title)}" />`)
    if (og.description)
      parts.push(
        `<meta property="og:description" content="${escAttr(
          og.description
        )}" />`
      )
    if (og.image) {
      const u = abs(og.image) ?? og.image
      parts.push(`<meta property="og:image" content="${escAttr(u)}" />`)
    }
    const ogUrl = og.url
      ? (abs(og.url) ?? og.url)
      : origin
        ? absoluteRouteUrl(origin, pathname, pathPolicy)
        : ""
    if (ogUrl)
      parts.push(`<meta property="og:url" content="${escAttr(ogUrl)}" />`)
  }

  const tw = head.twitter
  if (tw) {
    if (tw.card)
      parts.push(`<meta name="twitter:card" content="${escAttr(tw.card)}" />`)
    if (tw.title)
      parts.push(`<meta name="twitter:title" content="${escAttr(tw.title)}" />`)
    if (tw.description)
      parts.push(
        `<meta name="twitter:description" content="${escAttr(
          tw.description
        )}" />`
      )
    if (tw.image) {
      const u = abs(tw.image) ?? tw.image
      parts.push(`<meta name="twitter:image" content="${escAttr(u)}" />`)
    }
  }

  for (const row of head.extraMeta ?? []) {
    const attrs = Object.entries(row)
      .map(([k, v]) => `${k}="${escAttr(v)}"`)
      .join(" ")
    parts.push(`<meta ${attrs} />`)
  }

  for (const row of head.links ?? []) {
    const attrs = Object.entries(row)
      .map(([k, v]) => `${k}="${escAttr(v)}"`)
      .join(" ")
    parts.push(`<link ${attrs} />`)
  }

  const jsonLdRows = head.jsonLd
    ? Array.isArray(head.jsonLd)
      ? head.jsonLd
      : [head.jsonLd]
    : []
  for (const row of jsonLdRows) {
    const json = escJsonLdScript(JSON.stringify(row))
    parts.push(`<script type="application/ld+json">${json}</script>`)
  }

  return parts.join("\n    ")
}

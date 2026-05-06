import type { RouteMeta } from "./types.js"

function mergeExtraMeta(
  base?: Array<Record<string, string>>,
  override?: Array<Record<string, string>>
): Array<Record<string, string>> | undefined {
  const merged = [...(base ?? []), ...(override ?? [])]
  if (!merged.length) return undefined
  const byKey = new Map<string, Record<string, string>>()
  for (const row of merged) {
    const key =
      row.name ?? row.property ?? row.httpEquiv ?? JSON.stringify(row)
    byKey.set(key, row)
  }
  return [...byKey.values()]
}

export function mergeRouteMeta(base: RouteMeta, override?: RouteMeta): RouteMeta {
  if (!override) {
    return {
      ...base,
      openGraph: base.openGraph ? { ...base.openGraph } : undefined,
      twitter: base.twitter ? { ...base.twitter } : undefined,
      extraMeta: base.extraMeta ? [...base.extraMeta] : undefined,
    }
  }
  return {
    ...base,
    ...override,
    openGraph: { ...base.openGraph, ...override.openGraph },
    twitter: { ...base.twitter, ...override.twitter },
    extraMeta: mergeExtraMeta(base.extraMeta, override.extraMeta),
  }
}

function tpl(s: string | undefined, params: Record<string, string>): string | undefined {
  if (s === undefined) return undefined
  return s.replace(/\{(\w+)\}/g, (_, k: string) => params[k] ?? "")
}

export function resolveMetaTemplates(
  meta: RouteMeta,
  params: Record<string, string>
): RouteMeta {
  const og = meta.openGraph
  const tw = meta.twitter
  return {
    ...meta,
    title: tpl(meta.title, params),
    description: tpl(meta.description, params),
    robots: tpl(meta.robots, params),
    canonical: tpl(meta.canonical, params),
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
    extraMeta: meta.extraMeta?.map((row) => {
      const next: Record<string, string> = {}
      for (const [k, v] of Object.entries(row)) {
        next[k] = tpl(v, params) ?? ""
      }
      return next
    }),
  }
}

function escAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
}

function escText(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;")
}

/**
 * Returns HTML fragment for inside <head> (no <title> wrapper duplication if title empty).
 */
export function serializeDocumentHead(
  meta: RouteMeta,
  context?: { pathname?: string; origin?: string }
): string {
  const parts: string[] = []
  const pathname = context?.pathname ?? "/"
  const origin = context?.origin ?? ""
  const abs = (url: string | undefined) => {
    if (!url) return undefined
    if (url.startsWith("http://") || url.startsWith("https://")) return url
    if (url.startsWith("/") && origin) return `${origin.replace(/\/$/, "")}${url}`
    return url
  }

  if (meta.title) parts.push(`<title>${escText(meta.title)}</title>`)
  if (meta.description) {
    parts.push(
      `<meta name="description" content="${escAttr(meta.description)}" />`
    )
  }
  if (meta.robots) {
    parts.push(`<meta name="robots" content="${escAttr(meta.robots)}" />`)
  }
  if (meta.canonical) {
    const href = abs(meta.canonical) ?? meta.canonical
    parts.push(`<link rel="canonical" href="${escAttr(href)}" />`)
  }

  const og = meta.openGraph
  if (og) {
    if (og.title)
      parts.push(`<meta property="og:title" content="${escAttr(og.title)}" />`)
    if (og.description)
      parts.push(
        `<meta property="og:description" content="${escAttr(og.description)}" />`
      )
    if (og.image) {
      const u = abs(og.image) ?? og.image
      parts.push(`<meta property="og:image" content="${escAttr(u)}" />`)
    }
    const ogUrl = og.url ? abs(og.url) ?? og.url : origin ? `${origin}${pathname}` : ""
    if (ogUrl) parts.push(`<meta property="og:url" content="${escAttr(ogUrl)}" />`)
  }

  const tw = meta.twitter
  if (tw) {
    if (tw.card)
      parts.push(`<meta name="twitter:card" content="${escAttr(tw.card)}" />`)
    if (tw.title)
      parts.push(`<meta name="twitter:title" content="${escAttr(tw.title)}" />`)
    if (tw.description)
      parts.push(
        `<meta name="twitter:description" content="${escAttr(tw.description)}" />`
      )
    if (tw.image) {
      const u = abs(tw.image) ?? tw.image
      parts.push(`<meta name="twitter:image" content="${escAttr(u)}" />`)
    }
  }

  for (const row of meta.extraMeta ?? []) {
    const attrs = Object.entries(row)
      .map(([k, v]) => `${k}="${escAttr(v)}"`)
      .join(" ")
    parts.push(`<meta ${attrs} />`)
  }

  return parts.join("\n    ")
}

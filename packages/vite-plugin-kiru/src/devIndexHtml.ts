import fs from "node:fs/promises"
import path from "node:path"
import type { ViteDevServer } from "vite"

/**
 * Read `index.html` and run Vite's full `transformIndexHtml` pipeline (SSG dev parity).
 */
export async function getDevHtmlTemplate(
  server: ViteDevServer,
  projectRoot: string,
  templateName: string,
  url: string
): Promise<string> {
  const templatePath = path.resolve(projectRoot, templateName)
  const source = await fs.readFile(templatePath, "utf8")
  return server.transformIndexHtml(url, source)
}

const HEAD_CHILD_TAG_RE =
  /<script\b[\s\S]*?<\/script>|<link\b[^>]*\/?>|<meta\b[^>]*\/?>|<style\b[\s\S]*?<\/style>/gi

function normalizeHeadTag(tag: string): string {
  return tag.replace(/\s+/g, " ").trim()
}

function extractHeadTags(headInner: string): string[] {
  const tags: string[] = []
  let m: RegExpExecArray | null
  HEAD_CHILD_TAG_RE.lastIndex = 0
  while ((m = HEAD_CHILD_TAG_RE.exec(headInner)) !== null) {
    tags.push(m[0])
  }
  return tags
}

/** Extra `<head>` markup from transformIndexHtml not present in the raw template. */
export function extractHeadInjection(raw: string, transformed: string): string {
  const rawHead = matchHeadInner(raw)
  const transformedHead = matchHeadInner(transformed)
  if (!rawHead || !transformedHead) return ""
  if (transformedHead === rawHead) return ""
  if (transformedHead.startsWith(rawHead)) {
    return transformedHead.slice(rawHead.length).trim()
  }
  // Vite may prepend `@vite/client` (or other plugins reorder `<head>`), so compare tags
  // instead of dumping the full transformed head (which would re-insert `{{kiru_head}}`).
  const rawTags = new Set(extractHeadTags(rawHead).map(normalizeHeadTag))
  const added = extractHeadTags(transformedHead).filter(
    (tag) => !rawTags.has(normalizeHeadTag(tag))
  )
  return added.join("\n    ")
}

function matchHeadInner(html: string): string | null {
  const m = /<head[^>]*>([\s\S]*?)<\/head>/i.exec(html)
  return m ? m[1] : null
}

/**
 * Head snippets to inject into SSR dev HTML responses (devtools + transformIndexHtml delta).
 */
export async function collectSsrDevHeadExtras(
  server: ViteDevServer,
  projectRoot: string,
  templateName: string,
  url: string,
  extraChunks: string[] = []
): Promise<string> {
  const templatePath = path.resolve(projectRoot, templateName)
  const raw = await fs.readFile(templatePath, "utf8")
  const transformed = await server.transformIndexHtml(url, raw)
  const fromTransform = extractHeadInjection(raw, transformed)
  return [...extraChunks, fromTransform].filter(Boolean).join("\n    ")
}

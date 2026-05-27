import { parseTemplateRefMarkers } from "./componentFold.js"

export function escapeTemplateLiteralStatic(segment: string): string {
  return segment
    .replace(/\\/g, "\\\\")
    .replace(/`/g, "\\`")
    .replace(/\$\{/g, "\\${")
}

/** Emit `_template(...)` or `_template(\`...\${$t0.html}...\`, n)` when html contains ref markers. */
export function buildTemplateFactoryExpr(
  html: string,
  holeCount: number,
  refVarMap: Map<string, string>
): string {
  const markerRe = /<!--@kiru-tpl-ref:([^@]+)@-->/g
  if (!html.includes("<!--@kiru-tpl-ref:")) {
    if (holeCount === 0) return `_template(${JSON.stringify(html)})`
    return `_template(${JSON.stringify(html)}, ${holeCount})`
  }

  const parts: string[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null
  markerRe.lastIndex = 0
  while ((match = markerRe.exec(html)) !== null) {
    const before = html.slice(lastIndex, match.index)
    if (before) parts.push(escapeTemplateLiteralStatic(before))
    const name = match[1]!
    const varName = refVarMap.get(name)
    if (!varName) {
      throw new Error(
        `[kiru]: missing template factory for folded component "${name}"`
      )
    }
    parts.push(`\${${varName}.html}`)
    lastIndex = match.index + match[0].length
  }
  const tail = html.slice(lastIndex)
  if (tail) parts.push(escapeTemplateLiteralStatic(tail))

  const inner = parts.join("")
  if (holeCount === 0) return `_template(\`${inner}\`)`
  return `_template(\`${inner}\`, ${holeCount})`
}

export function htmlUsesTemplateRefs(html: string): boolean {
  return parseTemplateRefMarkers(html).length > 0
}

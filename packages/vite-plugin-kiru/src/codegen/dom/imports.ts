function findEndOfLastImport(source: string): number {
  const importRe = /^import\s[\s\S]*?from\s*["'][^"']+["'];?\s*\r?\n/gm
  let end = 0
  let m: RegExpExecArray | null
  while ((m = importRe.exec(source)) !== null) {
    end = m.index + m[0].length
  }
  return end
}

function findStartOfFirstImport(source: string): number {
  const m = source.match(/^import\s/m)
  return m?.index ?? -1
}

function mergeDomImports(source: string, needed: Set<string>): string {
  let out = source.replace(
    /import\s*\{[^}]+\}\s*from\s*["'][^"']*jsx[^"']*["'];?\s*\r?\n?/g,
    ""
  )

  const existing = new Set<string>()
  const domImportRe =
    /import\s*\{([^}]+)\}\s*from\s*["']kiru\/dom["'];?\s*\r?\n?/
  const existingMatch = domImportRe.exec(out)
  if (existingMatch) {
    for (const part of existingMatch[1]!.split(",")) {
      const chunk = part.trim()
      if (!chunk) continue
      if (chunk.startsWith("type ")) {
        existing.add(chunk.slice(5).trim())
      } else {
        existing.add(chunk.split(/\s+as\s+/)[0]!.trim())
      }
    }
    out = out.replace(domImportRe, "")
  }

  const values = [...new Set([...existing, ...needed])].filter(
    (n) => n !== "DomAppHandle" && n !== "ComponentHandle"
  )
  const types = [...existing, ...needed].filter(
    (n) => n === "DomAppHandle" || n === "ComponentHandle"
  )
  const uniqueTypes = [...new Set(types)]

  if (values.length === 0 && uniqueTypes.length === 0) return out

  const typePart =
    uniqueTypes.length > 0
      ? `, type ${uniqueTypes.join(", type ")}`
      : ""
  const importLine = `import { ${values.join(", ")}${typePart} } from "kiru/dom"\n`

  const forImportRe =
    /import\s*\{([^}]*)\}\s*from\s*["']kiru["'];?\s*\r?\n?/
  out = out.replace(forImportRe, (_m, specs: string) => {
    const kept = specs
      .split(",")
      .map((s: string) => s.trim())
      .filter((s: string) => s && s !== "For")
    return kept.length > 0 ? `import { ${kept.join(", ")} } from "kiru"\n` : ""
  })

  const firstImport = findStartOfFirstImport(out)
  if (firstImport === -1) return importLine + out
  return out.slice(0, firstImport) + importLine + out.slice(firstImport)
}

export { mergeDomImports, collectExistingImports, findEndOfLastImport }

function collectExistingImports(source: string): Set<string> {
  const found = new Set<string>()
  const re = /import\s*\{([^}]+)\}\s*from\s*["']kiru\/dom["']/g
  let m: RegExpExecArray | null
  while ((m = re.exec(source)) !== null) {
    for (const part of m[1]!.split(",")) {
      const chunk = part.trim()
      if (chunk.startsWith("type ")) {
        found.add(chunk.slice(5).trim())
      } else {
        found.add(chunk.split(/\s+as\s+/)[0]!.trim())
      }
    }
  }
  return found
}

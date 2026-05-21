/** Match leaf filenames against user page file globs (e.g. `page.{tsx,mdx}`). */
export function fileNameMatchesPagePattern(
  fileName: string,
  patterns: string[]
): boolean {
  for (const pattern of patterns) {
    const re = globPatternToRegExp(pattern)
    if (re.test(fileName)) return true
  }
  return false
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function globPatternToRegExp(pattern: string): RegExp {
  let re = "^"
  let i = 0
  while (i < pattern.length) {
    if (pattern[i] === "{") {
      const end = pattern.indexOf("}", i)
      if (end === -1) break
      const alts = pattern
        .slice(i + 1, end)
        .split(",")
        .map((a) => escapeRegex(a.trim()))
        .join("|")
      re += `(${alts})`
      i = end + 1
      continue
    }
    re += escapeRegex(pattern[i]!)
    i++
  }
  re += "$"
  return new RegExp(re)
}

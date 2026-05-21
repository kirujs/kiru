const GROUP_RE = /^\([^/)]+\)$/
const PRIVATE_RE = /^_/
const DYNAMIC_RE =
  /^\[(?:\[\.\.\.([^/\]]+)\]\]|\[\.\.\.([^/\]]+)\]|(?:\[\[([^/\]]+)\]\]|([^/\]]+)))\]$/

export type ParsedDirSegment =
  | { kind: "static"; name: string; urlToken: string }
  | { kind: "group"; name: string }
  | { kind: "private"; name: string }
  | { kind: "dynamic"; name: string; urlToken: string }

export function parseDirSegment(name: string): ParsedDirSegment {
  if (GROUP_RE.test(name)) return { kind: "group", name }
  if (PRIVATE_RE.test(name)) return { kind: "private", name }
  const m = name.match(DYNAMIC_RE)
  if (m) {
    const key = m[1] ?? m[2] ?? m[3] ?? m[4]
    if (m[1]) return { kind: "dynamic", name, urlToken: `[[...${key}]]` }
    if (m[2]) return { kind: "dynamic", name, urlToken: `[...${key}]` }
    if (m[3]) return { kind: "dynamic", name, urlToken: `[[${key}]]` }
    return { kind: "dynamic", name, urlToken: `[${key}]` }
  }
  return { kind: "static", name, urlToken: name }
}

export function isCatchAllToken(token: string): boolean {
  return token.startsWith("[...") || token.startsWith("[[...")
}

export function urlSegmentsToPath(segments: string[]): string {
  if (segments.length === 0) return "/"
  return "/" + segments.join("/")
}

export function appendUrlSegment(
  segments: string[],
  parsed: ParsedDirSegment
): string[] {
  if (parsed.kind === "group" || parsed.kind === "private") return segments
  return [...segments, parsed.urlToken]
}

export function pathHasPrivateSegment(relativeParts: string[]): boolean {
  return relativeParts.some((p) => PRIVATE_RE.test(p))
}

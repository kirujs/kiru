import type { ImagePattern } from "./types.js"

function globToRegExp(glob: string): RegExp {
  const escaped = glob
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*/g, "{{GLOBSTAR}}")
    .replace(/\*/g, "[^/]*")
    .replace(/\{\{GLOBSTAR\}\}/g, ".*")
  return new RegExp(`^${escaped}$`)
}

export function matchPathPattern(pathname: string, pattern: ImagePattern): boolean {
  const re = globToRegExp(pattern.pathname)
  if (!re.test(pathname)) return false
  if (pattern.search !== undefined && pattern.search !== "") {
    return false
  }
  return true
}

export function matchLocalImageUrl(
  url: string,
  patterns: readonly ImagePattern[]
): boolean {
  if (!url.startsWith("/")) return false
  const pathname = url.split("?")[0]?.split("#")[0] ?? url
  return patterns.some((p) => matchPathPattern(pathname, p))
}

export function matchRemoteImageUrl(
  url: string,
  patterns: readonly ImagePattern[]
): boolean {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return false
  }
  for (const p of patterns) {
    if (p.protocol && p.protocol !== parsed.protocol.replace(":", "")) continue
    if (p.hostname && !hostMatches(parsed.hostname, p.hostname)) continue
    if (p.port !== undefined && p.port !== parsed.port) continue
    const pathname = parsed.pathname
    if (!matchPathPattern(pathname, { ...p, pathname: p.pathname })) continue
    if (p.search !== undefined && p.search !== "" && parsed.search !== p.search) {
      continue
    }
    return true
  }
  return false
}

function hostMatches(hostname: string, pattern: string): boolean {
  if (pattern.startsWith("**.")) {
    const suffix = pattern.slice(3)
    return hostname === suffix || hostname.endsWith(`.${suffix}`)
  }
  if (pattern.includes("*")) {
    return globToRegExp(pattern).test(hostname)
  }
  return hostname === pattern
}

export function isAllowedImageUrl(
  url: string,
  localPatterns: readonly ImagePattern[],
  remotePatterns: readonly ImagePattern[]
): "local" | "remote" | false {
  if (url.startsWith("/")) {
    return matchLocalImageUrl(url, localPatterns) ? "local" : false
  }
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return matchRemoteImageUrl(url, remotePatterns) ? "remote" : false
  }
  return false
}

export type RouterQuery = Record<string, string[]>

export type RequestUrlState = {
  search: string
  hash: string
  query: RouterQuery
}

export function parseQuery(search: string): RouterQuery {
  const out: RouterQuery = {}
  const params = new URLSearchParams(search)
  params.forEach((value, key) => {
    ;(out[key] ??= []).push(value)
  })
  return out
}

export function parseRequestUrl(
  url: string,
  base = "http://localhost"
): RequestUrlState {
  const parsed = new URL(url, base)
  return {
    search: parsed.search,
    hash: parsed.hash,
    query: parseQuery(parsed.search),
  }
}

export type RouterTargetParts = {
  pathname: string
  search: string
  /** Includes leading `#` when non-empty. */
  hash: string
}

/** Split a router `to` target into pathname, search, and hash segments. */
export function splitRouterTo(to: string): RouterTargetParts {
  const hashIndex = to.indexOf("#")
  const searchIndex = to.indexOf("?")

  let pathname = to
  let search = ""
  let hash = ""

  if (hashIndex >= 0) {
    hash = to.slice(hashIndex)
    pathname = to.slice(0, hashIndex)
  }
  if (searchIndex >= 0 && (hashIndex < 0 || searchIndex < hashIndex)) {
    search = pathname.slice(searchIndex)
    pathname = pathname.slice(0, searchIndex)
  }

  return { pathname, search, hash: normalizeRouterHash(hash) }
}

/** Ensure hash fragments use a `#` prefix; bare `#` clears the hash. */
export function normalizeRouterHash(hash: string): string {
  if (!hash || hash === "#") return ""
  return hash.startsWith("#") ? hash : `#${hash}`
}

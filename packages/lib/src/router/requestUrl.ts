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

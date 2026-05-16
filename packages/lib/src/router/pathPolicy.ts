export type TrailingSlashPolicy = "always" | "never"

export interface RouterPathPolicy {
  /** App mount path without trailing slash (default `/`). */
  baseUrl?: string
  trailingSlash?: TrailingSlashPolicy
}

export const DEFAULT_PATH_POLICY: Required<RouterPathPolicy> = {
  baseUrl: "/",
  trailingSlash: "never",
}

export function resolvePathPolicy(
  policy?: RouterPathPolicy
): Required<RouterPathPolicy> {
  return {
    baseUrl: normalizeBaseUrl(policy?.baseUrl ?? DEFAULT_PATH_POLICY.baseUrl),
    trailingSlash: policy?.trailingSlash ?? DEFAULT_PATH_POLICY.trailingSlash,
  }
}

/** Strip query/hash; collapse slashes; no trailing slash except root `/`. */
export function normalizePathname(pathname: string): string {
  const clean = pathname.split("?")[0]?.split("#")[0] || "/"
  if (clean === "/") return "/"
  return "/" + clean.split("/").filter(Boolean).join("/")
}

export function normalizeBaseUrl(baseUrl: string): string {
  const normalized = normalizePathname(baseUrl)
  return normalized === "/" ? "/" : normalized.replace(/\/$/, "")
}

export function stripBase(pathname: string, baseUrl: string): string {
  if (baseUrl === "/") return normalizePathname(pathname)
  const normalized = normalizePathname(pathname)
  if (normalized === baseUrl) return "/"
  if (normalized.startsWith(`${baseUrl}/`)) {
    return normalizePathname(normalized.slice(baseUrl.length))
  }
  return normalized
}

export function addBase(pathname: string, baseUrl: string): string {
  if (baseUrl === "/") return normalizePathname(pathname)
  const normalized = normalizePathname(pathname)
  if (normalized === "/") return baseUrl
  return `${baseUrl}${normalized}`
}

/** Apply trailing-slash policy to a normalized pathname. */
export function formatPathname(
  pathname: string,
  policy?: RouterPathPolicy
): string {
  const resolved = resolvePathPolicy(policy)
  let path = normalizePathname(pathname)
  if (resolved.trailingSlash === "always" && path !== "/") {
    path = `${path}/`
  }
  return path
}

/** Pathname for route matching (trailing slash stripped). */
export function pathnameForMatch(
  pathname: string,
  policy?: RouterPathPolicy
): string {
  const stripped = normalizePathname(pathname)
  return stripBase(stripped, resolvePathPolicy(policy).baseUrl)
}

/** Build absolute site URL for a route path (sitemap, canonical). */
export function absoluteRouteUrl(
  origin: string,
  pathname: string,
  policy?: RouterPathPolicy
): string {
  const resolved = resolvePathPolicy(policy)
  const base = origin.replace(/\/$/, "")
  const withBase = formatPathname(addBase(pathname, resolved.baseUrl), resolved)
  if (withBase === "/") return `${base}/`
  return `${base}${withBase}`
}

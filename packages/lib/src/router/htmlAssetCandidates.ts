import { extname } from "node:path"

/**
 * Deploy-time static miss behavior when no prerender HTML exists for a pathname.
 * Does not change {@link matchRoute} or scope `notFound` semantics.
 */
export type NotFoundStrategy =
  | "exact"
  | "csr-recovery"
  | "hybrid-ssr"

export type InferNotFoundStrategyInput = {
  ssg?: boolean
  serverEntry?: string | boolean | null | undefined
}

/** Default strategy for vite preview / static hosting from router config. */
export function inferNotFoundStrategy(
  input: InferNotFoundStrategyInput
): NotFoundStrategy {
  if (input.ssg && input.serverEntry) return "hybrid-ssr"
  if (input.ssg) return "exact"
  return "exact"
}

/** Normalize a URL or pathname to a leading-slash path without query or hash. */
export function normalizeAssetPathname(urlOrPath: string): string {
  const stripped = urlOrPath.split("?")[0].split("#")[0] || "/"
  if (!stripped.startsWith("/")) {
    const clean = stripped.replace(/^\/+/, "")
    return clean ? `/${clean}` : "/"
  }
  return stripped || "/"
}

function pathnameLookupVariants(pathname: string): string[] {
  const variants = new Set<string>([pathname])
  try {
    const decoded = decodeURI(pathname)
    if (decoded !== pathname) variants.add(decoded)
  } catch {
    /* ignore malformed escape sequences */
  }
  try {
    const encoded = pathname
      .split("/")
      .map((segment, index) => {
        if (index === 0 && segment === "") return ""
        return encodeURIComponent(decodeURIComponent(segment))
      })
      .join("/")
    if (encoded !== pathname) variants.add(encoded)
  } catch {
    /* ignore malformed escape sequences */
  }
  return [...variants]
}

/**
 * URL pathnames to probe for prerendered HTML (preview disk, Workers `getAsset`, etc.).
 * Order matters: first hit wins.
 */
export function resolveHtmlAssetCandidates(pathname: string): string[] {
  const candidates: string[] = []
  for (const p of pathnameLookupVariants(normalizeAssetPathname(pathname))) {
    const ext = extname(p)

    if (ext === ".html") {
      candidates.push(p)
      continue
    }
    if (ext) continue

    if (p.endsWith("/")) {
      candidates.push(`${p}index.html`)
      continue
    }

    candidates.push(p, `${p}.html`, `${p}/index.html`)
  }
  return candidates
}

/** Try each {@link resolveHtmlAssetCandidates} pathname until `getAsset` returns HTML. */
export async function fetchHtmlAsset(
  getAsset: (pathname: string) => Promise<string | null>,
  pathname: string
): Promise<string | null> {
  for (const candidate of resolveHtmlAssetCandidates(pathname)) {
    const html = await getAsset(candidate)
    if (html) return html
  }
  return null
}

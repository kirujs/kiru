import type { RouteRevalidate } from "./routeRevalidate.js"

export type RouteCachePolicy = "no-store" | "immutable"

/**
 * Map ISR `revalidate` and static-route defaults to `Cache-Control`.
 *
 * @see docs/v2/10-isr-hybrid-and-prerender.md
 */
export function cachePolicyToHeaders(
  policy: RouteCachePolicy | undefined,
  staticRoute: boolean,
  revalidate?: RouteRevalidate
): Record<string, string> {
  if (policy === "no-store") {
    return { "cache-control": "no-store" }
  }
  if (typeof revalidate === "number" && revalidate > 0) {
    const swr = Math.max(1, Math.floor(revalidate))
    return {
      "cache-control": `public, s-maxage=${revalidate}, stale-while-revalidate=${swr}`,
    }
  }
  if (policy === "immutable" || (staticRoute && revalidate !== false)) {
    return {
      "cache-control": "public, max-age=31536000, immutable",
    }
  }
  if (revalidate === false) {
    return {
      "cache-control": "public, max-age=31536000, immutable",
    }
  }
  return { "cache-control": "no-store" }
}

export function mergeResponseHeaders(
  ...parts: (HeadersInit | Record<string, string> | undefined)[]
): Record<string, string> {
  const out: Record<string, string> = {}
  for (const part of parts) {
    if (!part) continue
    const entries: [string, string][] =
      part instanceof Headers
        ? Array.from(part.entries())
        : Array.isArray(part)
          ? part
          : Object.entries(part)
    for (const [key, value] of entries) {
      out[key.toLowerCase()] = value
    }
  }
  return out
}

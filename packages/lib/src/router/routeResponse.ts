import type { LoaderContext, PageProps } from "./loaders.js"
import type { KiruLoader } from "./loaders.js"
import type { RouteRevalidate } from "./routeRevalidate.js"

export type RouteHeadersFn = (
  ctx: LoaderContext,
  pageProps?: PageProps<KiruLoader<unknown>>
) => HeadersInit

export type KiruRouteHeaders = {
  __kiruRouteHeaders: true
  resolve: RouteHeadersFn
}

export type RouteStatusFn = (
  ctx: LoaderContext,
  pageProps?: PageProps<KiruLoader<unknown>>
) => number

export type RouteCachePolicy = "no-store" | "immutable"

/**
 * Page export: `export const headers = defineRouteHeaders(…)` merged into SSR responses.
 * Accepts static `HeadersInit` or a function of loader context (and optional page props).
 */
export function defineRouteHeaders(
  headersOrFn: HeadersInit | RouteHeadersFn
): KiruRouteHeaders {
  if (typeof headersOrFn === "function") {
    return { __kiruRouteHeaders: true, resolve: headersOrFn }
  }
  return {
    __kiruRouteHeaders: true,
    resolve: () => headersOrFn,
  }
}

function isModuleRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function isRouteStatusFn(value: unknown): value is RouteStatusFn {
  return typeof value === "function"
}

export function isKiruRouteHeaders(value: unknown): value is KiruRouteHeaders {
  return (
    isModuleRecord(value) &&
    "__kiruRouteHeaders" in value &&
    typeof value.resolve === "function"
  )
}

export function readRouteHeadersExport(mod: unknown): KiruRouteHeaders | undefined {
  if (!isModuleRecord(mod)) return undefined
  const h = mod.headers
  return isKiruRouteHeaders(h) ? h : undefined
}

export function readRouteStatusExport(
  mod: unknown
): number | RouteStatusFn | undefined {
  if (!isModuleRecord(mod)) return undefined
  const s = mod.status
  if (typeof s === "number") return s
  if (isRouteStatusFn(s)) return s
  return undefined
}

export function readRouteCacheExport(mod: unknown): RouteCachePolicy | undefined {
  if (!isModuleRecord(mod)) return undefined
  const c = mod.cache
  if (c === "no-store" || c === "immutable") return c
  return undefined
}

export function resolveRouteStatus(
  statusExport: number | RouteStatusFn | undefined,
  ctx: LoaderContext,
  pageProps?: PageProps<KiruLoader<unknown>>
): number | undefined {
  if (statusExport === undefined) return undefined
  if (typeof statusExport === "number") return statusExport
  return statusExport(ctx, pageProps)
}

/**
 * Map `export const cache` and optional `revalidate` to `Cache-Control`.
 * Static routes default to immutable when no policy is set.
 *
 * @see docs/router/tier-3-wave-1.md#hybrid-isr
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

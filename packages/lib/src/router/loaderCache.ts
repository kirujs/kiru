/**
 * In-memory loader result cache for client navigations.
 *
 * Loader dedupe layers:
 * - {@link runLoaderRpcSingleFlight} — canonical RPC single-flight by cache key
 * - prefetchRoute `prefetchFlightByHref` — href-level coalesce + abort on re-hover
 * - routeInterceptors `interceptorPrefetchInFlight` — soft-intercept load prefetch
 *
 * @see docs/router/tier-3-wave-1.md#loader-caching
 */

export const DEFAULT_LOADER_STALE_TIME_MS = 0
export const DEFAULT_LOADER_GC_TIME_MS = 5 * 60_000

export type LoaderCacheEntry<T = unknown> = {
  data: T
  fetchedAt: number
  staleTime: number
  gcTime: number
}

const cache = new Map<string, LoaderCacheEntry>()
const staleRevalidateInFlight = new Map<string, Promise<void>>()
/** Canonical loader RPC single-flight map (see also href prefetch + interceptor prefetch). */
const loaderRpcInFlight = new Map<string, Promise<unknown>>()

export function getLoaderRpcInFlight(
  key: string
): Promise<unknown> | undefined {
  return loaderRpcInFlight.get(key)
}

export function runLoaderRpcSingleFlight(
  key: string,
  fn: () => Promise<unknown>
): Promise<unknown> {
  const existing = loaderRpcInFlight.get(key)
  if (existing) return existing
  const promise = fn().finally(() => {
    if (loaderRpcInFlight.get(key) === promise) {
      loaderRpcInFlight.delete(key)
    }
  })
  loaderRpcInFlight.set(key, promise)
  return promise
}

/** Single-flight stale background refetch per cache key. */
export function scheduleStaleLoaderRevalidate(
  key: string,
  run: () => Promise<void>
): void {
  if (staleRevalidateInFlight.has(key)) return
  const flight = run().finally(() => {
    staleRevalidateInFlight.delete(key)
  })
  staleRevalidateInFlight.set(key, flight)
}

const KEY_SEP = "|||"

export function buildLoaderCacheKey(
  routeId: string,
  pathname: string,
  search: string
): string {
  return `${routeId}${KEY_SEP}${pathname}${KEY_SEP}${search}`
}

function parseLoaderCacheKey(key: string): {
  routeId: string
  pathname: string
} {
  const parts = key.split(KEY_SEP)
  return { routeId: parts[0] ?? "", pathname: parts[1] ?? "" }
}

export function getLoaderCacheEntry<T = unknown>(
  key: string
): LoaderCacheEntry<T> | undefined {
  const entry = cache.get(key) as LoaderCacheEntry<T> | undefined
  if (!entry) return undefined
  const age = Date.now() - entry.fetchedAt
  if (age > entry.gcTime) {
    cache.delete(key)
    return undefined
  }
  return entry
}

export function setLoaderCacheEntry<T>(
  key: string,
  entry: LoaderCacheEntry<T>
): void {
  cache.set(key, entry as LoaderCacheEntry)
}

export function isLoaderCacheStale(entry: LoaderCacheEntry): boolean {
  return Date.now() - entry.fetchedAt > entry.staleTime
}

export type InvalidateLoaderCacheOptions = {
  routeIds?: string[]
  pathname?: string
}

/** Clear matching loader cache entries (used by `router.invalidate()`). */
export function invalidateLoaderCache(
  options?: InvalidateLoaderCacheOptions
): void {
  if (!options?.routeIds?.length && !options?.pathname) {
    cache.clear()
    return
  }
  const routePrefix = options.routeIds?.length
    ? new Set(options.routeIds)
    : null
  for (const key of [...cache.keys()]) {
    const { routeId, pathname } = parseLoaderCacheKey(key)
    if (routePrefix && !routePrefix.has(routeId)) continue
    if (options.pathname && pathname !== options.pathname) continue
    cache.delete(key)
  }
}

/** @internal Test helper */
export function clearLoaderCacheForTests(): void {
  cache.clear()
  staleRevalidateInFlight.clear()
  loaderRpcInFlight.clear()
}

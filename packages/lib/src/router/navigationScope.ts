import { buildLoaderCacheKey } from "./loaderCache.js"

/** Stable, never-aborted signal for one-off static renders (tests, ad-hoc). */
let staticLoaderAbort: AbortController | undefined

/** Active SSG / `prerenderStaticRoutes` build (see {@link runWithPrerenderSignal}). */
let activePrerenderSignal: AbortSignal | undefined

export function staticLoaderSignal(): AbortSignal {
  return (staticLoaderAbort ??= new AbortController()).signal
}

/** Prefer `Request.signal`, then an active prerender build, then {@link staticLoaderSignal}. */
export function loaderSignalFromRequest(request?: Request): AbortSignal {
  return request?.signal ?? activePrerenderSignal ?? staticLoaderSignal()
}

/** Run `fn` while loader/SSR string renders use `signal` when no `Request` is present. */
export async function runWithPrerenderSignal<T>(
  signal: AbortSignal,
  fn: () => Promise<T>
): Promise<T> {
  const prev = activePrerenderSignal
  activePrerenderSignal = signal
  try {
    return await fn()
  } finally {
    activePrerenderSignal = prev
  }
}

export function isAbortError(err: unknown): boolean {
  return (
    (err instanceof DOMException && err.name === "AbortError") ||
    (err instanceof Error && err.name === "AbortError")
  )
}

export type NavigationScope = {
  generation: number
  signal: AbortSignal
  /** routeId + pathname + search — for stale cache revalidation checks */
  cacheKey?: string
}

export function createNavigationScope(
  generation: number,
  signal: AbortSignal,
  cacheKey?: string
): NavigationScope {
  return { generation, signal, cacheKey }
}

export function buildScopeCacheKey(
  routeId: string,
  pathname: string,
  search: string
): string {
  return buildLoaderCacheKey(routeId, pathname, search)
}

export function isScopeCurrent(
  scope: NavigationScope | undefined,
  getGeneration: () => number
): boolean {
  if (!scope) return true
  if (scope.signal.aborted) return false
  return scope.generation === getGeneration()
}

export function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) {
    throw new DOMException("Aborted", "AbortError")
  }
}

/** True when scope is still valid for committing loader cache / UI updates. */
export function canCommitLoaderResult(
  scope: NavigationScope | undefined,
  getGeneration: () => number,
  cacheKey?: string
): boolean {
  if (!scope) return true
  if (!isScopeCurrent(scope, getGeneration)) return false
  if (cacheKey !== undefined && scope.cacheKey !== undefined) {
    return scope.cacheKey === cacheKey
  }
  return true
}

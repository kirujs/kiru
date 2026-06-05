import { buildQueryCacheKey, buildQueryWireRefId } from "./stableSerialize.js"
import type { KiruQueryPatch } from "./queryPatch.js"

export type QueryCacheEntry = {
  data: unknown
  error?: unknown
  pending?: Promise<unknown>
}

const cache = new Map<string, QueryCacheEntry>()
const subscribers = new Map<string, Set<() => void>>()

export type KiruQuerySnapshot = {
  queryId: string
  input: unknown
  data: unknown
}

export function getQueryCacheEntry(key: string): QueryCacheEntry | undefined {
  return cache.get(key)
}

/** Resolve SSR-seeded entries keyed by wire ref id as well as canonical cache keys. */
export function getQueryCacheEntryForKey(
  cacheKey: string
): QueryCacheEntry | undefined {
  const direct = cache.get(cacheKey)
  if (direct) return direct
  return cache.get(buildQueryWireRefId(cacheKey))
}

export function setQueryCacheEntry(key: string, data: unknown): void {
  cache.set(key, { data })
  notifySubscribers(key)
}

export function setQueryCachePending(
  key: string,
  pending: Promise<unknown>
): void {
  const prev = cache.get(key)
  cache.set(key, { ...prev, data: prev?.data, pending })
}

/** Drop a stored in-flight promise without clearing resolved data. */
export function clearQueryCachePendingIfMatches(
  key: string,
  pending: Promise<unknown>
): void {
  const entry = cache.get(key)
  if (entry?.pending !== pending) return
  if (entry.data !== undefined) {
    setQueryCacheEntry(key, entry.data)
  } else {
    clearQueryCacheEntry(key)
  }
}

export function clearQueryCacheEntry(key: string): void {
  cache.delete(key)
  notifySubscribers(key)
}

export function clearAllQueryCache(): void {
  cache.clear()
}

export function seedQueryCache(snapshots: readonly KiruQuerySnapshot[]): void {
  for (const { queryId, input, data } of snapshots) {
    const key = buildQueryCacheKey(queryId, input)
    setQueryCacheEntry(key, data)
  }
}

export function collectQuerySnapshots(): KiruQuerySnapshot[] {
  const out: KiruQuerySnapshot[] = []
  for (const [key, entry] of cache) {
    const colon = key.indexOf(":")
    if (colon < 0) continue
    const queryId = key.slice(0, colon)
    let input: unknown = null
    try {
      input = JSON.parse(key.slice(colon + 1))
    } catch {
      continue
    }
    if (entry.data !== undefined) {
      out.push({ queryId, input, data: entry.data })
    }
  }
  return out
}

export function subscribeQueryCache(key: string, fn: () => void): () => void {
  let set = subscribers.get(key)
  if (!set) {
    set = new Set()
    subscribers.set(key, set)
  }
  set.add(fn)
  return () => {
    set!.delete(fn)
    if (set!.size === 0) subscribers.delete(key)
  }
}

function notifySubscribers(key: string): void {
  const set = subscribers.get(key)
  if (!set) return
  for (const fn of set) fn()
}

export function applyQueryPatches(patches: readonly KiruQueryPatch[]): void {
  for (const patch of patches) {
    const key = buildQueryCacheKey(patch.queryId, patch.input)
    if (patch.op === "set" || patch.op === "refresh") {
      setQueryCacheEntry(key, patch.data)
    }
  }
}

export {
  buildQueryCacheKey,
  buildQueryWireRefId,
} from "./stableSerialize.js"

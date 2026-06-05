import {
  createQueryCacheSubscriptionBinder,
  type QueryCacheSubscriptionBinder,
} from "./queryCacheTrackBinder.js"

export type { QueryCacheSubscriptionBinder }
export { createQueryCacheSubscriptionBinder }

/** Active set while synchronously starting queries (nested loads restore the previous set). */
export const currentlyObservedQueries: {
  current: Set<string> | undefined
} = { current: undefined }

export function noteQueryCacheKey(key: string): void {
  currentlyObservedQueries.current?.add(key)
}

export function captureSyncQueryObservations<T>(fn: () => T): {
  observed: Set<string>
  value: T
} {
  const prev = currentlyObservedQueries.current
  const observed = new Set<string>()
  currentlyObservedQueries.current = observed
  try {
    return { observed, value: fn() }
  } finally {
    currentlyObservedQueries.current = prev
  }
}

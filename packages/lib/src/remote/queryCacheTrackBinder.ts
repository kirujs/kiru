import { subscribeQueryCache } from "./queryCache.js"

export type QueryCacheSubscriptionBinder = {
  reconcile(keys: Iterable<string>): void
  dispose(): void
}

export function createQueryCacheSubscriptionBinder(
  onInvalidate: () => void
): QueryCacheSubscriptionBinder {
  const unsubs = new Map<string, () => void>()

  return {
    reconcile(keys: Iterable<string>) {
      const next = new Set(keys)
      for (const [key, unsub] of unsubs) {
        if (next.has(key)) continue
        unsub()
        unsubs.delete(key)
      }
      for (const key of next) {
        if (unsubs.has(key)) continue
        unsubs.set(key, subscribeQueryCache(key, onInvalidate))
      }
    },
    dispose() {
      for (const unsub of unsubs.values()) unsub()
      unsubs.clear()
    },
  }
}

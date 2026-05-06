import type { RouteMeta } from "./types.js"
import { mergeRouteMeta } from "./meta.js"
import { isResource, type Resource } from "../resource.js"

export type HeadContent =
  | RouteMeta
  | ((value: unknown) => RouteMeta)

export interface HeadCollector {
  /** Current merged meta (starts at resolved route-tree meta). */
  meta: RouteMeta
  /** Merge a meta object into the current head meta. */
  merge(meta: RouteMeta): void
  /**
   * Register async meta contribution from a resource.
   * This is awaited before SSR streaming begins.
   */
  using<T>(res: Resource<T>, content: (value: T) => RouteMeta): void
  /** Await all registered async contributions. */
  resolve(): Promise<RouteMeta>
}

let current: HeadCollector | null = null

export function getHeadCollector(): HeadCollector | null {
  return current
}

export function withHeadCollector<T>(collector: HeadCollector, fn: () => T): T {
  const prev = current
  current = collector
  try {
    return fn()
  } finally {
    current = prev
  }
}

export function createHeadCollector(base: RouteMeta): HeadCollector {
  let meta = mergeRouteMeta({}, base)
  const pending: Promise<void>[] = []

  return {
    get meta() {
      return meta
    },
    merge(next) {
      meta = mergeRouteMeta(meta, next)
    },
    using(res, content) {
      pending.push(
        res.promise.then((value) => {
          meta = mergeRouteMeta(meta, content(value))
        })
      )
    },
    async resolve() {
      if (pending.length) await Promise.all(pending)
      return meta
    },
  }
}

export function coerceResource<T>(value: unknown): Resource<T> | null {
  if (isResource(value)) return value as Resource<T>
  return null
}


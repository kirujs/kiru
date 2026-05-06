import type { RouteHeadMeta } from "./types.js"
import { mergeRouteHead } from "./meta.js"
import { isResource, type Resource } from "../resource.js"

export type HeadContent = RouteHeadMeta | ((value: unknown) => RouteHeadMeta)

export interface HeadCollector {
  /** Current merged head (starts at resolved route-tree head). */
  head: RouteHeadMeta
  /** Merge a head object into the current head meta. */
  merge(head: RouteHeadMeta): void
  /**
   * Register async head contribution from a resource.
   * This is awaited before SSR streaming begins.
   */
  using<T>(res: Resource<T>, content: (value: T) => RouteHeadMeta): void
  /** Await all registered async contributions. */
  resolve(): Promise<RouteHeadMeta>
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

export function createHeadCollector(base: RouteHeadMeta): HeadCollector {
  let head = mergeRouteHead({}, base)
  const pending: Promise<void>[] = []

  return {
    get head() {
      return head
    },
    merge(next) {
      head = mergeRouteHead(head, next)
    },
    using(res, content) {
      pending.push(
        res.promise.then((value) => {
          head = mergeRouteHead(head, content(value))
        })
      )
    },
    async resolve() {
      if (pending.length) await Promise.all(pending)
      return head
    },
  }
}

export function coerceResource<T>(value: unknown): Resource<T> | null {
  if (isResource(value)) return value as Resource<T>
  return null
}

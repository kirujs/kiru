import { mergeRouteHead } from "./meta.js"
import type { RouteHeadMeta } from "./types.js"
import type { RouterPathPolicy } from "./pathPolicy.js"

type HeadSyncContext = {
  pathname?: string
  origin?: string
  pathPolicy?: RouterPathPolicy
}

let lastSyncedTitle = ""

/** Resolved document title from merged route + page head. */
export function resolveDocumentTitle(head: RouteHeadMeta): string | undefined {
  return head.title
}

/**
 * Client navigations (CSR and post-hydration): update `document.title` only.
 * Full meta / OG / JSON-LD stay from the initial HTML (SSR/SSG) or `index.html` shell.
 */
export function applyDocumentTitle(
  head: RouteHeadMeta,
  _context?: HeadSyncContext
): void {
  if (typeof document === "undefined") return
  const title = resolveDocumentTitle(head)
  if (!title || (document.title === title && lastSyncedTitle === title)) return
  document.title = title
  lastSyncedTitle = title
}

export function mergeAndSyncClientDocumentHead(
  routeHead: RouteHeadMeta,
  pageHead: RouteHeadMeta | undefined,
  context?: HeadSyncContext
): void {
  const merged = pageHead ? mergeRouteHead(routeHead, pageHead) : routeHead
  applyDocumentTitle(merged, context)
}

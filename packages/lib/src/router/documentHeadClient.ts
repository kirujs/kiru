import { mergeRouteHead, resolveMetaTemplates, serializeDocumentHead } from "./meta.js"
import type { RouteHeadMeta } from "./types.js"
import type { RouterPathPolicy } from "./pathPolicy.js"

const KIRU_MANAGED_ATTR = "data-kiru-head"

export function syncClientDocumentHead(
  head: RouteHeadMeta,
  context?: {
    pathname?: string
    origin?: string
    pathPolicy?: RouterPathPolicy
    params?: Record<string, string>
  }
): void {
  if (typeof document === "undefined") return
  const resolved = context?.params
    ? resolveMetaTemplates(head, context.params)
    : head
  applyDocumentHead(resolved, context)
}

export function applyDocumentHead(
  head: RouteHeadMeta,
  context?: {
    pathname?: string
    origin?: string
    pathPolicy?: RouterPathPolicy
  }
): void {
  if (typeof document === "undefined") return

  document.head
    .querySelectorAll(`[${KIRU_MANAGED_ATTR}]`)
    .forEach((el) => el.remove())

  if (head.title) {
    document.title = head.title
    let titleEl = document.head.querySelector("title")
    if (!titleEl) {
      titleEl = document.createElement("title")
      document.head.appendChild(titleEl)
    }
    titleEl.textContent = head.title
    titleEl.setAttribute(KIRU_MANAGED_ATTR, "")
  }

  const fragment = serializeDocumentHead({ ...head, title: undefined }, context)
  if (!fragment.trim()) return

  const tpl = document.createElement("template")
  tpl.innerHTML = `    ${fragment}`
  for (const node of Array.from(tpl.content.childNodes)) {
    if (node.nodeType !== 1) continue
    const el = node as Element
    if (el.tagName === "TITLE") continue
    el.setAttribute(KIRU_MANAGED_ATTR, "")
    document.head.appendChild(el)
  }
}

export function mergeAndSyncClientDocumentHead(
  routeHead: RouteHeadMeta,
  pageHead: RouteHeadMeta | undefined,
  params: Record<string, string>,
  context?: {
    pathname?: string
    origin?: string
    pathPolicy?: RouterPathPolicy
  }
): void {
  const base = resolveMetaTemplates(routeHead, params)
  const merged = pageHead ? mergeRouteHead(base, pageHead) : base
  syncClientDocumentHead(merged, { ...context, params })
}

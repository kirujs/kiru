import {
  headContentFingerprint,
  KIRU_HEAD_COMMENT_END,
  KIRU_HEAD_COMMENT_START,
  mergeRouteHead,
  resolveMetaTemplates,
  serializeDocumentHeadContent,
  wrapKiruHeadHtml,
} from "./meta.js"
import type { RouteHeadMeta } from "./types.js"
import type { RouterPathPolicy } from "./pathPolicy.js"

const COMMENT_NODE = 8
const LEGACY_MANAGED_ATTR = "data-kiru-head"

type KiruHeadBounds = {
  start: Comment
  end: Comment
  elements: Element[]
}

type HeadSyncContext = {
  pathname?: string
  origin?: string
  pathPolicy?: RouterPathPolicy
}

let lastSyncedFingerprint = ""

function isKiruHeadComment(node: Node, marker: string): boolean {
  return (
    node.nodeType === COMMENT_NODE &&
    (node as Comment).data.trim() === marker
  )
}

function findKiruHeadBounds(head: HTMLHeadElement): KiruHeadBounds | null {
  let start: Comment | null = null
  let end: Comment | null = null
  for (const node of head.childNodes) {
    if (isKiruHeadComment(node, KIRU_HEAD_COMMENT_START)) start = node as Comment
    else if (isKiruHeadComment(node, KIRU_HEAD_COMMENT_END)) end = node as Comment
  }
  if (!start || !end) return null

  const elements: Element[] = []
  for (
    let node: ChildNode | null = start.nextSibling;
    node && node !== end;
    node = node.nextSibling
  ) {
    if (node.nodeType === 1) elements.push(node as Element)
  }
  return { start, end, elements }
}

function headElementKey(el: Element, ldJsonIndex: number): string | null {
  const tag = el.tagName
  if (tag === "TITLE") return "title"
  if (tag === "META") {
    const name = el.getAttribute("name")
    if (name) return `meta:name:${name}`
    const property = el.getAttribute("property")
    if (property) return `meta:property:${property}`
    const httpEquiv = el.getAttribute("http-equiv")
    if (httpEquiv) return `meta:http-equiv:${httpEquiv}`
    return `meta:attrs:${el.attributes.length}`
  }
  if (tag === "LINK") {
    return `link:${el.getAttribute("rel") ?? ""}|${el.getAttribute("as") ?? ""}`
  }
  if (tag === "SCRIPT" && el.getAttribute("type") === "application/ld+json") {
    return `script:ld+json:${ldJsonIndex}`
  }
  return null
}

/** Read live head content into the same shape as {@link buildHeadContentSnapshot}. */
function fingerprintHeadElements(elements: Element[]): string {
  const snap: Record<string, unknown> = {}
  const jsonLd: unknown[] = []
  let ldJsonIndex = 0

  for (const el of elements) {
    const key = headElementKey(el, ldJsonIndex)
    if (key?.startsWith("script:ld+json:")) {
      ldJsonIndex++
      try {
        jsonLd.push(JSON.parse(el.textContent ?? "null"))
      } catch {
        jsonLd.push(null)
      }
      continue
    }
    if (key === "title") {
      snap.title = el.textContent ?? ""
      continue
    }
    if (key === "meta:name:description") {
      snap.description = el.getAttribute("content") ?? ""
      continue
    }
    if (key === "meta:name:robots") {
      snap.robots = el.getAttribute("content") ?? ""
      continue
    }
    if (key?.startsWith("meta:name:twitter:")) {
      if (!snap.twitter) snap.twitter = {}
      const field = key.slice("meta:name:twitter:".length)
      ;(snap.twitter as Record<string, string>)[field] =
        el.getAttribute("content") ?? ""
      continue
    }
    if (key?.startsWith("meta:property:og:")) {
      if (!snap.openGraph) snap.openGraph = {}
      const field = key.slice("meta:property:og:".length)
      ;(snap.openGraph as Record<string, string>)[field] =
        el.getAttribute("content") ?? ""
      continue
    }
    if (key?.startsWith("link:")) {
      if (!snap.links) snap.links = []
      const rel = el.getAttribute("rel") ?? ""
      const row: Record<string, string> = { rel }
      const href = el.getAttribute("href")
      if (href) row.href = href
      const as = el.getAttribute("as")
      if (as) row.as = as
      ;(snap.links as Record<string, string>[]).push(row)
    }
  }

  if (jsonLd.length === 1) snap.jsonLd = jsonLd[0]
  else if (jsonLd.length > 1) snap.jsonLd = jsonLd

  return JSON.stringify(snap)
}

function syncDocumentTitle(title: string | undefined): void {
  if (title && document.title !== title) document.title = title
}

function elementsMatch(existing: Element, desired: Element): boolean {
  if (existing.tagName !== desired.tagName) return false
  if ((existing.textContent ?? "") !== (desired.textContent ?? "")) return false
  if (existing.attributes.length !== desired.attributes.length) return false
  for (let i = 0; i < desired.attributes.length; i++) {
    const attr = desired.attributes[i]!
    if (existing.getAttribute(attr.name) !== attr.value) return false
  }
  return true
}

function parseDesiredHeadElements(innerHtml: string): Element[] {
  if (!innerHtml.trim()) return []
  const tpl = document.createElement("template")
  tpl.innerHTML = `    ${innerHtml}`
  return Array.from(tpl.content.children) as Element[]
}

function patchElement(existing: Element, desired: Element): void {
  if (existing.tagName !== desired.tagName) {
    existing.replaceWith(desired.cloneNode(true))
    return
  }
  if ((existing.textContent ?? "") !== (desired.textContent ?? "")) {
    existing.textContent = desired.textContent
  }
  for (let i = 0; i < desired.attributes.length; i++) {
    const attr = desired.attributes[i]!
    if (existing.getAttribute(attr.name) !== attr.value) {
      existing.setAttribute(attr.name, attr.value)
    }
  }
  for (let i = existing.attributes.length - 1; i >= 0; i--) {
    const attr = existing.attributes[i]!
    if (!desired.hasAttribute(attr.name)) existing.removeAttribute(attr.name)
  }
}

function reconcileKiruHeadBlock(
  head: HTMLHeadElement,
  bounds: KiruHeadBounds,
  desiredElements: Element[]
): void {
  const existingByKey: Record<string, Element> = {}
  let ldJsonIndex = 0
  for (const el of bounds.elements) {
    const key = headElementKey(el, ldJsonIndex)
    if (key?.startsWith("script:ld+json:")) ldJsonIndex++
    if (key) existingByKey[key] = el
  }

  const used: Record<string, true> = {}
  ldJsonIndex = 0
  for (const desiredEl of desiredElements) {
    const key = headElementKey(desiredEl, ldJsonIndex)
    if (key?.startsWith("script:ld+json:")) ldJsonIndex++

    if (!key) {
      head.insertBefore(desiredEl.cloneNode(true), bounds.end)
      continue
    }

    const existing = existingByKey[key]
    if (existing) {
      if (!elementsMatch(existing, desiredEl)) patchElement(existing, desiredEl)
      used[key] = true
    } else {
      head.insertBefore(desiredEl.cloneNode(true), bounds.end)
      used[key] = true
    }
  }

  for (const key in existingByKey) {
    if (!used[key]) existingByKey[key]!.remove()
  }
}

function insertKiruHeadBlock(
  head: HTMLHeadElement,
  html: string,
  insertBefore: ChildNode | null
): void {
  const tpl = document.createElement("template")
  tpl.innerHTML = html
  const nodes = Array.from(tpl.content.childNodes)
  if (insertBefore) {
    for (const node of nodes) head.insertBefore(node, insertBefore)
  } else {
    head.append(...nodes)
  }
}

export function syncClientDocumentHead(
  head: RouteHeadMeta,
  context?: HeadSyncContext & { params?: Record<string, string> }
): void {
  if (typeof document === "undefined") return
  const resolved = context?.params
    ? resolveMetaTemplates(head, context.params)
    : head
  applyDocumentHead(resolved, context)
}

export function applyDocumentHead(
  head: RouteHeadMeta,
  context?: HeadSyncContext
): void {
  if (typeof document === "undefined") return

  const fingerprint = headContentFingerprint(head, context)
  const headEl = document.head
  const bounds = findKiruHeadBounds(headEl)

  if (bounds && fingerprintHeadElements(bounds.elements) === fingerprint) {
    lastSyncedFingerprint = fingerprint
    syncDocumentTitle(head.title)
    return
  }

  if (bounds && fingerprint === lastSyncedFingerprint) {
    syncDocumentTitle(head.title)
    return
  }

  const inner = serializeDocumentHeadContent(head, context)

  if (bounds) {
    reconcileKiruHeadBlock(headEl, bounds, parseDesiredHeadElements(inner))
  } else if (inner.trim()) {
    headEl
      .querySelectorAll(`[${LEGACY_MANAGED_ATTR}]`)
      .forEach((el) => el.remove())
    insertKiruHeadBlock(headEl, wrapKiruHeadHtml(inner), headEl.firstChild)
  } else {
    headEl
      .querySelectorAll(`[${LEGACY_MANAGED_ATTR}]`)
      .forEach((el) => el.remove())
  }

  lastSyncedFingerprint = fingerprint
  syncDocumentTitle(head.title)
}

export function mergeAndSyncClientDocumentHead(
  routeHead: RouteHeadMeta,
  pageHead: RouteHeadMeta | undefined,
  params: Record<string, string>,
  context?: HeadSyncContext
): void {
  const base = resolveMetaTemplates(routeHead, params)
  const merged = pageHead ? mergeRouteHead(base, pageHead) : base
  syncClientDocumentHead(merged, { ...context, params })
}

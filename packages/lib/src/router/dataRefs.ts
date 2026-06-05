import { setQueryCacheEntry } from "../remote/queryCache.js"
import { isQueryWireRefId } from "../remote/stableSerialize.js"

export const KIRU_QUERY_REF_KEY = "$$ref" as const

export type KDataPayload = {
  queryId?: string
  input?: unknown
  data?: unknown
  error?: string
}

export type QueryRefMarker = {
  [KIRU_QUERY_REF_KEY]: string
}

export type QueryInjectionEmbedEntry = {
  wireRefId: string
  payload: { data: unknown } | { error: string }
}

let clientKDataStore: Map<string, KDataPayload> | null = null

export function getClientKDataStore(): Map<string, KDataPayload> {
  if (!clientKDataStore) clientKDataStore = new Map()
  return clientKDataStore
}

export function resetClientKDataStore(): void {
  clientKDataStore = null
}

/** URL-safe `k-data` attribute value (wire refs are already safe; legacy keys are base64url). */
export function encodeQueryRefAttr(refId: string): string {
  if (isQueryWireRefId(refId)) return refId
  const bytes = new TextEncoder().encode(refId)
  let binary = ""
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "")
}

export function decodeQueryRefAttr(encoded: string): string {
  if (isQueryWireRefId(encoded)) return encoded
  const base64 = encoded.replace(/-/g, "+").replace(/_/g, "/")
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4)
  const binary = atob(padded)
  const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

export function isRefMarker(value: unknown): value is QueryRefMarker {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    return false
  }
  const record = value as Record<string, unknown>
  const ref = record[KIRU_QUERY_REF_KEY]
  return typeof ref === "string" && Object.keys(record).length === 1
}

function ingestKDataPayloadForWireRef(
  wireRefId: string,
  store: Map<string, KDataPayload>
): KDataPayload | undefined {
  const cached = store.get(wireRefId)
  if (cached) return cached

  if (typeof document === "undefined") return undefined
  const queryAll = document.querySelectorAll
  if (typeof queryAll !== "function") return undefined

  for (const el of queryAll.call(document, "script[k-data]")) {
    const encoded = el.getAttribute("k-data")
    if (!encoded) continue
    let attrWireRefId: string
    try {
      attrWireRefId = decodeQueryRefAttr(encoded)
    } catch {
      continue
    }
    if (attrWireRefId !== wireRefId) continue
    try {
      const parsed = JSON.parse(el.textContent || "null") as KDataPayload
      store.set(wireRefId, parsed)
      getClientKDataStore().set(wireRefId, parsed)
      if (parsed.data !== undefined) {
        setQueryCacheEntry(wireRefId, parsed.data)
      }
      el.remove()
      return parsed
    } catch {
      el.remove()
    }
  }
  return undefined
}

function resolveRefMarker(
  marker: QueryRefMarker,
  store: Map<string, KDataPayload>
): unknown {
  const wireRefId = marker[KIRU_QUERY_REF_KEY]
  const refPayload =
    store.get(wireRefId) ?? ingestKDataPayloadForWireRef(wireRefId, store)
  if (!refPayload) return undefined
  if (refPayload.error) throw new Error(refPayload.error)
  return refPayload.data
}

/** Deep-resolve nested `$$ref` markers against a k-data store keyed by wire ref id. */
export function resolveRefsInValue(
  value: unknown,
  store: Map<string, KDataPayload>
): unknown {
  if (isRefMarker(value)) {
    const resolved = resolveRefMarker(value, store)
    if (resolved === undefined) return value
    return resolved
  }
  if (Array.isArray(value)) {
    return value.map((item) => resolveRefsInValue(item, store))
  }
  if (value != null && typeof value === "object") {
    const out: Record<string, unknown> = {}
    for (const [key, item] of Object.entries(value)) {
      out[key] = resolveRefsInValue(item, store)
    }
    return out
  }
  return value
}

function tryResolveRefsInValue(
  value: unknown,
  store: Map<string, KDataPayload>
): unknown | null {
  if (isRefMarker(value)) {
    const resolved = resolveRefMarker(value, store)
    if (resolved === undefined) return null
    return resolved
  }
  if (Array.isArray(value)) {
    const out: unknown[] = []
    for (const item of value) {
      const resolved = tryResolveRefsInValue(item, store)
      if (resolved === null) return null
      out.push(resolved)
    }
    return out
  }
  if (value != null && typeof value === "object") {
    const out: Record<string, unknown> = {}
    for (const [key, item] of Object.entries(value)) {
      const resolved = tryResolveRefsInValue(item, store)
      if (resolved === null) return null
      out[key] = resolved
    }
    return out
  }
  return value
}

function valuesMatch(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

/** Cache keys embeddable by value when payload data is unique across entries. */
export function buildEmbeddableCacheKeyLookup(
  entries: readonly QueryInjectionEmbedEntry[]
): Map<string, string> {
  const bySerializedData = new Map<string, string[]>()
  for (const entry of entries) {
    if (!("data" in entry.payload)) continue
    const serialized = JSON.stringify(entry.payload.data)
    const list = bySerializedData.get(serialized) ?? []
    list.push(entry.wireRefId)
    bySerializedData.set(serialized, list)
  }
  const lookup = new Map<string, string>()
  for (const [serialized, wireRefIds] of bySerializedData) {
    if (wireRefIds.length === 1) {
      lookup.set(serialized, wireRefIds[0]!)
    }
  }
  return lookup
}

function embedSubtreeWithLookup(
  value: unknown,
  lookup: Map<string, string>
): unknown {
  const wireRefId = lookup.get(JSON.stringify(value))
  if (wireRefId) {
    return { [KIRU_QUERY_REF_KEY]: wireRefId }
  }
  if (Array.isArray(value)) {
    return value.map((item) => embedSubtreeWithLookup(item, lookup))
  }
  if (value != null && typeof value === "object") {
    const out: Record<string, unknown> = {}
    for (const [key, item] of Object.entries(value)) {
      out[key] = embedSubtreeWithLookup(item, lookup)
    }
    return out
  }
  return value
}

/** Replace subtrees matching uniquely-registered query payloads with `{ $$ref: cacheKey }`. */
export function embedRefsFromRegistry(
  value: unknown,
  entries: readonly QueryInjectionEmbedEntry[]
): unknown {
  return embedSubtreeWithLookup(value, buildEmbeddableCacheKeyLookup(entries))
}

/** @deprecated Use embedRefsFromRegistry; kept for direct tests. */
export function embedRefsInValue(
  value: unknown,
  cacheKeyBySerializedData: Map<string, string>
): unknown {
  return embedSubtreeWithLookup(value, cacheKeyBySerializedData)
}

export function resolveStreamRefPayload(
  payload: { data?: unknown; error?: string }
): { data?: unknown; error?: string } | null {
  if (payload.error) return { error: payload.error }
  if (!("data" in payload)) return null
  const resolved = tryResolveRefsInValue(
    payload.data,
    getClientKDataStore()
  )
  if (resolved === null) return null
  return { data: resolved }
}

export function escapeScriptJson(json: string): string {
  return json
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029")
}

export function serializeKDataScript(
  wireRefId: string,
  payload: KDataPayload
): string {
  const attr = encodeQueryRefAttr(wireRefId)
  const json = escapeScriptJson(JSON.stringify(payload))
  return `<script type="application/json" k-data="${attr}">${json}</script>`
}

export function parseKDataScriptsFromDocument(): Map<string, KDataPayload> {
  const store = new Map<string, KDataPayload>()
  if (typeof document === "undefined") return store
  const queryAll = document.querySelectorAll
  if (typeof queryAll !== "function") return store
  for (const el of queryAll.call(document, "script[k-data]")) {
    const encoded = el.getAttribute("k-data")
    if (!encoded) continue
    let wireRefId: string
    try {
      wireRefId = decodeQueryRefAttr(encoded)
    } catch {
      el.remove()
      continue
    }
    try {
      const parsed = JSON.parse(el.textContent || "null") as KDataPayload
      store.set(wireRefId, parsed)
      getClientKDataStore().set(wireRefId, parsed)
    } catch {
      // drop malformed script
    }
    el.remove()
  }
  return store
}

export function seedQueryCacheFromKDataStore(
  store: Map<string, KDataPayload>
): void {
  for (const [wireRefId, entry] of store) {
    if (entry.data !== undefined) {
      setQueryCacheEntry(wireRefId, entry.data)
    }
  }
}

export { valuesMatch }

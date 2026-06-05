import {
  buildQueryCacheKey,
  buildQueryWireRefId,
} from "../remote/stableSerialize.js"
import {
  embedRefsFromRegistry,
  type KDataPayload,
  serializeKDataScript,
  type QueryInjectionEmbedEntry,
} from "../router/dataRefs.js"

export type QueryInjectionPayload =
  | { data: unknown }
  | { error: string }

export type QueryInjectionEntry = {
  refId: string
  queryId: string
  input: unknown
  payload: QueryInjectionPayload
  cacheKey: string
}

let registry = new Map<string, QueryInjectionEntry>()
let refById = new Map<string, QueryInjectionEntry>()
let emittedWireRefIds = new Set<string>()
let headEmitted = false
let streamEmitter: ((script: string) => void) | null = null

export function resetQueryInjectionRegistry(): void {
  registry.clear()
  refById.clear()
  emittedWireRefIds.clear()
  headEmitted = false
}

export function setQueryInjectionStreamEmitter(
  fn: ((script: string) => void) | null
): void {
  streamEmitter = fn
}

function emitKDataIfNeeded(
  refId: string,
  payload: QueryInjectionPayload
): void {
  if (emittedWireRefIds.has(refId)) return
  if (!headEmitted || !streamEmitter) return
  const body: KDataPayload = { ...payload }
  streamEmitter(serializeKDataScript(refId, body))
  emittedWireRefIds.add(refId)
}

export function markQueryInjectionHeadEmitted(): void {
  for (const refId of refById.keys()) {
    emittedWireRefIds.add(refId)
  }
  headEmitted = true
}

export function registerQueryInjection(
  queryId: string,
  input: unknown,
  result: { ok: true; data: unknown } | { ok: false; error: string }
): string {
  const cacheKey = buildQueryCacheKey(queryId, input)
  const existing = registry.get(cacheKey)
  if (existing) return existing.refId

  const refId = buildQueryWireRefId(cacheKey)
  const payload: QueryInjectionPayload = result.ok
    ? { data: result.data }
    : { error: result.error }
  const entry: QueryInjectionEntry = {
    refId,
    queryId,
    input,
    payload,
    cacheKey,
  }
  registry.set(cacheKey, entry)
  refById.set(refId, entry)
  emitKDataIfNeeded(refId, payload)
  return refId
}

export function getQueryInjectionByCacheKey(
  cacheKey: string
): QueryInjectionEntry | undefined {
  return registry.get(cacheKey)
}

export function getQueryInjection(refId: string): QueryInjectionEntry | undefined {
  return refById.get(refId)
}

export function getAllQueryInjectionEntries(): QueryInjectionEntry[] {
  return [...refById.values()]
}

function toEmbedEntries(
  entries: readonly QueryInjectionEntry[]
): QueryInjectionEmbedEntry[] {
  return entries.map((entry) => ({
    wireRefId: entry.refId,
    payload: entry.payload,
  }))
}

/** Map in-memory loader data to nested $$ref markers when registry has matches. */
export function buildPageDataPayloadFromRegistry(data: unknown): unknown {
  return embedRefsFromRegistry(data, toEmbedEntries(getAllQueryInjectionEntries()))
}

export function collectInjectedQueryScriptTags(): string {
  const tags: string[] = []
  for (const entry of refById.values()) {
    const body: KDataPayload = { ...entry.payload }
    tags.push(serializeKDataScript(entry.refId, body))
  }
  markQueryInjectionHeadEmitted()
  return tags.join("\n    ")
}

export function buildStreamPayloadForInjection(
  promise: Kiru.StatefulPromise<unknown> & { __kiruQueryCacheKey?: string }
): { data?: unknown; error?: string } {
  if (promise.state === "rejected") {
    return { error: promise.error?.message ?? "Unknown error" }
  }
  if (promise.state === "fulfilled") {
    if (promise.__kiruQueryCacheKey) {
      return { data: { $$ref: promise.__kiruQueryCacheKey } }
    }
    return {
      data: embedRefsFromRegistry(
        promise.value,
        toEmbedEntries(getAllQueryInjectionEntries())
      ),
    }
  }
  return { error: "Pending" }
}

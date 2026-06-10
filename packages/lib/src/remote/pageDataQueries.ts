import {
  embedRefsFromRegistry,
  resolveRefsInValue,
  type KDataPayload,
  type QueryInjectionEmbedEntry,
} from "../router/dataRefs.js"
import {
  buildQueryCacheKey,
  seedQueryCache,
  type KiruQuerySnapshot,
} from "./queryCache.js"
import { buildQueryWireRefId } from "./stableSerialize.js"
import { KIRU_QUERIES_KEY } from "./querySnapshot.js"

function snapshotsToEmbedEntries(
  queries: readonly KiruQuerySnapshot[]
): QueryInjectionEmbedEntry[] {
  return queries.map(({ queryId, input, data }) => {
    const cacheKey = buildQueryCacheKey(queryId, input)
    return {
      wireRefId: buildQueryWireRefId(cacheKey),
      payload: { data },
    }
  })
}

function buildKDataStoreFromSnapshots(
  queries: readonly KiruQuerySnapshot[]
): Map<string, KDataPayload> {
  const store = new Map<string, KDataPayload>()
  for (const { queryId, input, data } of queries) {
    const wireRefId = buildQueryWireRefId(buildQueryCacheKey(queryId, input))
    store.set(wireRefId, { queryId, input, data })
  }
  return store
}

export function attachQueriesToPayload(
  data: unknown,
  queries: readonly KiruQuerySnapshot[]
): unknown {
  if (!queries.length) return data
  const entries = snapshotsToEmbedEntries(queries)
  const embedded = embedRefsFromRegistry(data, entries)
  if (embedded != null && typeof embedded === "object" && !Array.isArray(embedded)) {
    return { ...(embedded as object), [KIRU_QUERIES_KEY]: [...queries] }
  }
  return { data: embedded, [KIRU_QUERIES_KEY]: [...queries] }
}

export function splitQueriesFromPayload(payload: unknown): {
  data: unknown
  queries?: KiruQuerySnapshot[]
} {
  if (
    payload != null &&
    typeof payload === "object" &&
    !Array.isArray(payload) &&
    KIRU_QUERIES_KEY in (payload as object)
  ) {
    const record = payload as Record<string, unknown>
    const queries = record[KIRU_QUERIES_KEY]
    const { [KIRU_QUERIES_KEY]: _q, ...rest } = record
    return {
      data: rest,
      queries: Array.isArray(queries)
        ? (queries as KiruQuerySnapshot[])
        : undefined,
    }
  }
  return { data: payload }
}

export function seedQueriesFromPayload(payload: unknown): unknown {
  const { data, queries } = splitQueriesFromPayload(payload)
  if (queries?.length) {
    seedQueryCache(queries)
    return resolveRefsInValue(data, buildKDataStoreFromSnapshots(queries))
  }
  return data
}

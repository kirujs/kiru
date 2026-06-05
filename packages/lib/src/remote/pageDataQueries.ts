import { seedQueryCache, type KiruQuerySnapshot } from "./queryCache.js"
import { KIRU_QUERIES_KEY } from "./querySnapshot.js"

export function attachQueriesToPayload(
  data: unknown,
  queries: readonly KiruQuerySnapshot[]
): unknown {
  if (!queries.length) return data
  if (data != null && typeof data === "object" && !Array.isArray(data)) {
    return { ...(data as object), [KIRU_QUERIES_KEY]: [...queries] }
  }
  return { data, [KIRU_QUERIES_KEY]: [...queries] }
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
  if (queries?.length) seedQueryCache(queries)
  return data
}

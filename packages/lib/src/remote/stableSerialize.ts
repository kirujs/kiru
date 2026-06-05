function sortKeys(value: unknown): unknown {
  if (value === null || typeof value !== "object") return value
  if (Array.isArray(value)) return value.map(sortKeys)
  const obj = value as Record<string, unknown>
  const out: Record<string, unknown> = {}
  for (const key of Object.keys(obj).sort()) {
    out[key] = sortKeys(obj[key])
  }
  return out
}

export function stableSerialize(value: unknown): string {
  return JSON.stringify(sortKeys(value))
}

export function buildQueryCacheKey(queryId: string, input: unknown): string {
  return `${queryId}:${stableSerialize(input ?? null)}`
}

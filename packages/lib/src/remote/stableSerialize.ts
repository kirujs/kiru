function sortKeys(value: unknown): unknown {
  if (value === null || typeof value !== "object") return value
  if (Array.isArray(value)) return value.map(sortKeys)
  const obj = value as Record<string, unknown>
  const out: Record<string, unknown> = {}
  for (const key of Object.keys(obj).sort()) {
    const value = obj[key]
    if (value === null || value === undefined) continue
    out[key] = sortKeys(value)
  }
  return out
}

export function stableSerialize(value: unknown): string {
  return JSON.stringify(sortKeys(value))
}

export function buildQueryCacheKey(queryId: string, input: unknown): string {
  return `${queryId}:${stableSerialize(input ?? null)}`
}

const WIRE_REF_PREFIX = "k:q:" as const

function digestToBase64Url(bytes: Uint8Array): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64url")
  }
  let binary = ""
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "")
}

function digestCacheKey(cacheKey: string): string {
  let lo = 2_166_136_261
  let hi = 2_166_136_261 ^ 0x85ebca6b
  for (let i = 0; i < cacheKey.length; i++) {
    const code = cacheKey.charCodeAt(i)
    lo = Math.imul(lo ^ code, 1_677_761_9)
    hi = Math.imul(hi ^ (code & 0xff), 2_246_822_519)
  }
  const bytes = new Uint8Array(8)
  const view = new DataView(bytes.buffer)
  view.setUint32(0, lo >>> 0)
  view.setUint32(4, hi >>> 0)
  return digestToBase64Url(bytes)
}

/** Short stable id for $$ref / k-data attrs; hashes the full in-memory cache key. */
export function buildQueryWireRefId(cacheKey: string): string {
  return `${WIRE_REF_PREFIX}${digestCacheKey(cacheKey)}`
}

export function isQueryWireRefId(value: string): boolean {
  return value.startsWith(WIRE_REF_PREFIX)
}

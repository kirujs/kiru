import {
  KIRU_INVALIDATE_RESPONSE_HEADER,
  KIRU_TOKEN_RESPONSE_HEADER,
} from "./actionHeaders.js"

const RESERVED_HEADERS = new Set([
  KIRU_TOKEN_RESPONSE_HEADER,
  "content-type",
  "cookie",
  "x-kiru-form",
  KIRU_INVALIDATE_RESPONSE_HEADER,
  "host",
  "connection",
])

export function buildActionRpcHeaders(
  token: string,
  clientHeaders?: Record<string, string>
): Record<string, string> {
  const out: Record<string, string> = {
    [KIRU_TOKEN_RESPONSE_HEADER]: token,
    "Content-Type": "application/json",
  }
  if (!clientHeaders) return out

  for (const [rawKey, value] of Object.entries(clientHeaders)) {
    const key = rawKey.toLowerCase()
    if (RESERVED_HEADERS.has(key)) continue
    out[key] = value
  }
  return out
}

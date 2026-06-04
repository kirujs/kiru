import type { RouterQuery } from "./requestUrl.js"

export type KiruRequestLimits = {
  maxPathnameLength: number
  maxSearchLength: number
  maxQueryKeys: number
  maxQueryKeyLength: number
  maxQueryValueLength: number
  maxRouteParamLength: number
  maxRouteParamSegments: number
  maxJsonBodyBytes: number
  maxFormFields: number
  maxTokenLength: number
}

export const DEFAULT_REQUEST_LIMITS: KiruRequestLimits = {
  maxPathnameLength: 8192,
  maxSearchLength: 8192,
  maxQueryKeys: 64,
  maxQueryKeyLength: 256,
  maxQueryValueLength: 8192,
  maxRouteParamLength: 2048,
  maxRouteParamSegments: 128,
  maxJsonBodyBytes: 1_048_576,
  maxFormFields: 1024,
  maxTokenLength: 8192,
}

export type ResolvedRequestLimits = Readonly<KiruRequestLimits>

export function resolveRequestLimits(
  partial?: Partial<KiruRequestLimits>
): ResolvedRequestLimits {
  return { ...DEFAULT_REQUEST_LIMITS, ...partial }
}

export class RequestLimitError extends Error {
  readonly status: 400 | 413 | 414
  constructor(
    message: string,
    status: 400 | 413 | 414 = 400
  ) {
    super(message)
    this.name = "RequestLimitError"
    this.status = status
  }
}

export function isRequestLimitError(e: unknown): e is RequestLimitError {
  return e instanceof RequestLimitError
}

export type UrlLimitViolation = { status: 414 | 400; reason: string }

/** Check pathname and raw search (with or without leading `?`). */
export function checkUrlWithinLimits(
  pathname: string,
  search: string,
  limits: ResolvedRequestLimits = DEFAULT_REQUEST_LIMITS
): UrlLimitViolation | null {
  if (pathname.length > limits.maxPathnameLength) {
    return { status: 414, reason: "pathname too long" }
  }
  const searchRaw = search.startsWith("?") ? search.slice(1) : search
  if (searchRaw.length > limits.maxSearchLength) {
    return { status: 400, reason: "query string too long" }
  }
  return null
}

export function parseQueryBounded(
  search: string,
  limits: ResolvedRequestLimits = DEFAULT_REQUEST_LIMITS
): RouterQuery {
  const trimmed = search.startsWith("?") ? search.slice(1) : search
  if (!trimmed) return {}
  if (trimmed.length > limits.maxSearchLength) {
    throw new RequestLimitError("query string too long", 400)
  }

  const out: RouterQuery = {}
  const params = new URLSearchParams(trimmed)
  let keyCount = 0
  for (const [key, value] of params.entries()) {
    keyCount++
    if (keyCount > limits.maxQueryKeys) {
      throw new RequestLimitError("too many query keys", 400)
    }
    if (key.length > limits.maxQueryKeyLength) {
      throw new RequestLimitError("query key too long", 400)
    }
    if (value.length > limits.maxQueryValueLength) {
      throw new RequestLimitError("query value too long", 400)
    }
    ;(out[key] ??= []).push(value)
  }
  return out
}

function catchAllSegmentCount(value: string): number {
  if (!value) return 0
  return value.split("/").filter(Boolean).length
}

/**
 * Reject oversize route params (never truncate — preserves path semantics).
 * @returns false when any param violates limits
 */
export function validateRouteParams(
  params: Record<string, string>,
  limits: ResolvedRequestLimits = DEFAULT_REQUEST_LIMITS
): boolean {
  for (const value of Object.values(params)) {
    if (value.length > limits.maxRouteParamLength) return false
    if (catchAllSegmentCount(value) > limits.maxRouteParamSegments) {
      return false
    }
  }
  return true
}

const LOADER_RPC_BODY_KEYS = new Set([
  "params",
  "url",
  "query",
  "context",
  "meta",
  "route",
  "locale",
  "locales",
  "defaultLocale",
])

export function assertLoaderRpcBodyShape(body: unknown): void {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    throw new RequestLimitError("invalid loader RPC body", 400)
  }
  for (const key of Object.keys(body as object)) {
    if (!LOADER_RPC_BODY_KEYS.has(key)) {
      throw new RequestLimitError("unexpected loader RPC field", 400)
    }
  }
  const record = body as Record<string, unknown>
  if (
    record.params !== undefined &&
    (typeof record.params !== "object" ||
      record.params === null ||
      Array.isArray(record.params))
  ) {
    throw new RequestLimitError("invalid loader RPC params", 400)
  }
  if (
    record.query !== undefined &&
    (typeof record.query !== "object" ||
      record.query === null ||
      Array.isArray(record.query))
  ) {
    throw new RequestLimitError("invalid loader RPC query", 400)
  }
  if (
    record.url !== undefined &&
    (typeof record.url !== "object" ||
      record.url === null ||
      Array.isArray(record.url))
  ) {
    throw new RequestLimitError("invalid loader RPC url", 400)
  }
}

/** Reject oversize keys/values on a loader RPC query object. */
export function validateLoaderRpcQuery(
  query: Record<string, string | string[]>,
  limits: ResolvedRequestLimits = DEFAULT_REQUEST_LIMITS
): boolean {
  let keyCount = 0
  for (const [key, value] of Object.entries(query)) {
    keyCount++
    if (keyCount > limits.maxQueryKeys) return false
    if (key.length > limits.maxQueryKeyLength) return false
    const values = Array.isArray(value) ? value : [value]
    for (const v of values) {
      if (typeof v !== "string") return false
      if (v.length > limits.maxQueryValueLength) return false
    }
  }
  return true
}

export function assertTokenWithinLimits(
  token: string | null | undefined,
  limits: ResolvedRequestLimits = DEFAULT_REQUEST_LIMITS
): void {
  if (!token) return
  if (token.length > limits.maxTokenLength) {
    throw new RequestLimitError("token too long", 400)
  }
}

/** Bounded JSON read for RPC bodies (413 when over limit). */
export async function readBoundedJson(
  request: Request,
  maxBytes: number
): Promise<unknown> {
  const contentLength = request.headers.get("content-length")
  if (contentLength) {
    const n = Number(contentLength)
    if (Number.isFinite(n) && n > maxBytes) {
      throw new RequestLimitError("request body too large", 413)
    }
  }

  let buf: ArrayBuffer
  try {
    buf = await request.arrayBuffer()
  } catch {
    throw new RequestLimitError("invalid request body", 400)
  }
  if (buf.byteLength > maxBytes) {
    throw new RequestLimitError("request body too large", 413)
  }
  if (buf.byteLength === 0) return null
  const text = new TextDecoder().decode(buf)
  try {
    return JSON.parse(text) as unknown
  } catch {
    throw new RequestLimitError("invalid JSON body", 400)
  }
}

/** Best-effort form field cap after parse (runtime may buffer full body first). */
export function assertFormFieldCountWithinLimits(
  formData: FormData,
  limits: ResolvedRequestLimits = DEFAULT_REQUEST_LIMITS
): void {
  let count = 0
  for (const _ of formData.entries()) {
    count++
    if (count > limits.maxFormFields) {
      throw new RequestLimitError("too many form fields", 400)
    }
  }
}

export function requestLimitResponse(
  violation: UrlLimitViolation
): Response {
  return new Response(null, { status: violation.status })
}

/** Convert bounded router query to action RPC query shape. */
export function routerQueryToActionQuery(
  query: RouterQuery
): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {}
  for (const [key, values] of Object.entries(query)) {
    out[key] = values.length === 1 ? values[0]! : values
  }
  return out
}

/** Parse action URL search (excludes `action` param) with limits. */
export function parseActionQueryFromUrlBounded(
  url: URL,
  limits: ResolvedRequestLimits = DEFAULT_REQUEST_LIMITS
): Record<string, string | string[]> {
  const params = new URLSearchParams()
  for (const [key, value] of url.searchParams.entries()) {
    if (key === "action") continue
    params.append(key, value)
  }
  const search = params.toString()
  if (!search) return {}
  const query = parseQueryBounded(`?${search}`, limits)
  return routerQueryToActionQuery(query)
}

import {
  parseInput,
  type Schema,
} from "../validation/index.js"
import type { RouterQuery } from "./requestUrl.js"
import {
  defaultValidationInvalidHandler,
  validationInvalid,
  type ValidationInvalidHandler,
  type ValidationInvalidResult,
} from "./validationInvalid.js"

export type {
  ValidationInvalidContext,
  ValidationInvalidHandler,
  ValidationInvalidResult,
} from "./validationInvalid.js"
export {
  defaultValidationInvalidHandler,
  toRouteValidationFailure,
  validationInvalid,
} from "./validationInvalid.js"

/**
 * Normalized search validation (internal). Prefer `load.validation.query` on the page module.
 * @see defineSearchParams
 * @deprecated Use `export const load = loader({ validation: { query: … } })` instead of `validateSearch`.
 */
export type KiruSearchParams = {
  __kiruSearchParams: true
  schema: Schema<unknown>
  onInvalid: ValidationInvalidHandler
  defaults?: Record<string, unknown>
  /** When true, redirect if the URL search string does not match validated output. */
  redirectToCanonical?: boolean
}

export type DefineSearchParamsOptions<T> = {
  onInvalid?: ValidationInvalidHandler
  defaults?: Partial<T>
  redirectToCanonical?: boolean
}

/**
 * Declare URL search validation for a route (legacy `export const validateSearch`).
 *
 * @example
 * ```ts
 * export const validateSearch = defineSearchParams(z.object({ q: z.string() }))
 * ```
 */
export function defineSearchParams<T>(
  schema: Schema<T>,
  options?: DefineSearchParamsOptions<T>
): KiruSearchParams {
  return {
    __kiruSearchParams: true,
    schema: schema as Schema<unknown>,
    onInvalid: options?.onInvalid ?? defaultValidationInvalidHandler,
    defaults: options?.defaults as Record<string, unknown> | undefined,
    redirectToCanonical: options?.redirectToCanonical,
  }
}

export function isKiruSearchParams(value: unknown): value is KiruSearchParams {
  return (
    !!value &&
    typeof value === "object" &&
    "__kiruSearchParams" in value &&
    (value as KiruSearchParams).__kiruSearchParams === true
  )
}

function isSchemaLike(value: unknown): value is Schema<unknown> {
  if (!value || typeof value !== "object") return false
  return "~standard" in value || "safeParse" in value || "parse" in value
}

/** Read `validateSearch` from a page module (legacy export). */
export function readValidateSearchExport(mod: unknown): KiruSearchParams | undefined {
  if (!mod || typeof mod !== "object") return undefined
  const v = (mod as Record<string, unknown>).validateSearch
  if (isKiruSearchParams(v)) return v
  if (isSchemaLike(v)) {
    return defineSearchParams(v)
  }
  return undefined
}

function queryToSearchRecord(query: RouterQuery): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {}
  for (const [key, values] of Object.entries(query)) {
    if (values.length === 1) out[key] = values[0]!
    else if (values.length > 1) out[key] = values
  }
  return out
}

export type ValidateSearchResult<T> =
  | { ok: true; data: T }
  | { ok: false; invalid: ValidationInvalidResult }

/** Validate raw router query against a {@link KiruSearchParams} config. */
export async function validateSearchFromQuery<T>(
  config: KiruSearchParams,
  query: RouterQuery
): Promise<ValidateSearchResult<T>> {
  const raw = queryToSearchRecord(query)
  const merged = { ...config.defaults, ...raw }
  try {
    const data = await parseInput(config.schema, merged)
    return { ok: true, data: data as T }
  } catch {
    return {
      ok: false,
      invalid: config.onInvalid(validationInvalid),
    }
  }
}

/** Serialize validated query output to a stable query string (no leading `?`). */
export function serializeValidatedQuery(data: Record<string, unknown>): string {
  const params = new URLSearchParams()
  const keys = Object.keys(data).sort()
  for (const key of keys) {
    const value = data[key]
    if (value === undefined || value === null) continue
    if (Array.isArray(value)) {
      for (const item of value) params.append(key, String(item))
    } else {
      params.append(key, String(value))
    }
  }
  return params.toString()
}

/** Normalize a query string for stable comparison. */
export function normalizeQueryString(search: string): string {
  const trimmed = search.startsWith("?") ? search.slice(1) : search
  if (!trimmed) return ""
  const params = new URLSearchParams(trimmed)
  const entries = [...params.entries()].sort((a, b) =>
    a[0] === b[0] ? a[1].localeCompare(b[1]) : a[0].localeCompare(b[0])
  )
  return new URLSearchParams(entries).toString()
}

export function buildQueryStringFromRouterQuery(query: RouterQuery): string {
  const params = new URLSearchParams()
  for (const [key, values] of Object.entries(query).sort(([a], [b]) =>
    a.localeCompare(b)
  )) {
    for (const value of values) params.append(key, value)
  }
  return params.toString()
}

export function canonicalQueryDiffersFromUrl(
  rawQuery: RouterQuery,
  validated: Record<string, unknown>
): boolean {
  const canonical = serializeValidatedQuery(validated)
  const current = buildQueryStringFromRouterQuery(rawQuery)
  return normalizeQueryString(canonical) !== normalizeQueryString(current)
}

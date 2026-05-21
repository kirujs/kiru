import {
  parseInput,
  type Schema,
} from "../validation/index.js"
import type { KiruLoader } from "./loaders.js"
import { readPageLoadExport } from "./loaders.js"
import type { RouterQuery } from "./requestUrl.js"
import {
  canonicalQueryDiffersFromUrl,
  createQueryValidation,
  serializeValidatedQuery,
  toRouteValidationFailure,
  type KiruSearchParams,
  validateSearchFromQuery,
  validationInvalid,
} from "./searchParams.js"
import type { ValidationInvalidHandler } from "./validationInvalid.js"
import { defaultValidationInvalidHandler } from "./validationInvalid.js"

export type {
  ValidationInvalidContext,
  ValidationInvalidHandler,
  ValidationInvalidResult,
} from "./validationInvalid.js"
export { validationInvalid } from "./validationInvalid.js"

export type { InferSchemaOutput } from "../validation/index.js"

/**
 * Validation for a route's `load` export (`loader`, `serverLoader`, `clientLoader`).
 *
 * @example
 * ```ts
 * export const load = loader({
 *   validation: {
 *     query: z.object({ q: z.string().optional() }),
 *     queryDefaults: { q: "" },
 *     onInvalid: (c) => c.notFound(),
 *   },
 *   load: ({ query }) => ({ items: search(query.q) }),
 * })
 * ```
 */
export type LoaderValidationConfig = {
  query?: Schema<unknown>
  params?: Schema<unknown>
  onInvalid?: ValidationInvalidHandler
  /** Redirect when validated query (incl. defaults) differs from the URL search string. */
  redirectToCanonical?: boolean
  queryDefaults?: Record<string, unknown>
}

/** Enforces `queryDefaults` keys against the `query` schema output type. */
export type EnforceLoaderValidation<V extends LoaderValidationConfig> =
  V extends { query: infer S }
    ? S extends Schema<infer O>
      ? Omit<V, "queryDefaults"> & { queryDefaults?: Partial<O> }
      : V
    : V

export type KiruParamsValidation = {
  __kiruParamsValidation: true
  schema: Schema<unknown>
  onInvalid: ValidationInvalidHandler
  defaults?: Record<string, unknown>
}

export type KiruLoaderValidation = {
  query?: KiruSearchParams
  params?: KiruParamsValidation
}

export function normalizeLoaderValidation(
  config: LoaderValidationConfig
): KiruLoaderValidation {
  const onInvalid = config.onInvalid ?? defaultValidationInvalidHandler
  return {
    ...(config.query
      ? {
          query: createQueryValidation(config.query, {
            onInvalid,
            defaults: config.queryDefaults,
            redirectToCanonical: config.redirectToCanonical,
          }),
        }
      : {}),
    ...(config.params
      ? {
          params: {
            __kiruParamsValidation: true,
            schema: config.params as Schema<unknown>,
            onInvalid,
          },
        }
      : {}),
  }
}

export function readLoaderValidation(
  load: KiruLoader | undefined
): KiruLoaderValidation | undefined {
  return load?.__kiruValidation
}

export function resolveRouteValidation(
  _mod: unknown,
  load: KiruLoader | undefined
): KiruLoaderValidation | undefined {
  const fromLoader = readLoaderValidation(load)
  if (fromLoader?.query || fromLoader?.params) return fromLoader
  return undefined
}

export async function resolveRouteValidationForMatch(
  mod: unknown
): Promise<KiruLoaderValidation | undefined> {
  const load = readPageLoadExport(mod)
  return resolveRouteValidation(mod, load)
}

export type ValidateFieldResult<T> =
  | { ok: true; data: T }
  | { ok: false; invalid: import("./validationInvalid.js").ValidationInvalidResult }

export async function validateParamsFromRecord<T>(
  config: KiruParamsValidation,
  params: Record<string, string>
): Promise<ValidateFieldResult<T>> {
  const merged = { ...config.defaults, ...params }
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

export type RouteValidationFailure =
  | { kind: "notFound" }
  | { kind: "redirect"; location: string }

export type RouteValidationSuccess = {
  /** Validated query when `validation.query` is configured. */
  validatedQuery?: Record<string, unknown>
  /** Validated params when configured; otherwise raw match params. */
  params: Record<string, unknown>
}

export type RouteValidationLocation = {
  pathname: string
  hash?: string
}

/**
 * Validate query and path params before navigation or SSR render.
 * Handles canonical query redirects when `redirectToCanonical` is set.
 */
export async function validateRouteInput(
  validation: KiruLoaderValidation | undefined,
  rawQuery: RouterQuery,
  matchParams: Record<string, string>,
  location?: RouteValidationLocation
): Promise<
  | { ok: true; value: RouteValidationSuccess }
  | { ok: false; failure: RouteValidationFailure }
> {
  if (!validation?.query && !validation?.params) {
    return {
      ok: true,
      value: { params: { ...matchParams } },
    }
  }

  let validatedQuery: Record<string, unknown> | undefined
  let params: Record<string, unknown> = { ...matchParams }

  if (validation.query) {
    const result = await validateSearchFromQuery(validation.query, rawQuery)
    if (!result.ok) {
      return { ok: false, failure: toRouteValidationFailure(result.invalid) }
    }
    validatedQuery = result.data as Record<string, unknown>

    if (
      validation.query.redirectToCanonical &&
      location &&
      canonicalQueryDiffersFromUrl(rawQuery, validatedQuery)
    ) {
      const search = serializeValidatedQuery(validatedQuery)
      const hash = location.hash ?? ""
      return {
        ok: false,
        failure: {
          kind: "redirect",
          location: `${location.pathname}${search ? `?${search}` : ""}${hash}`,
        },
      }
    }
  }

  if (validation.params) {
    const result = await validateParamsFromRecord(validation.params, matchParams)
    if (!result.ok) {
      return { ok: false, failure: toRouteValidationFailure(result.invalid) }
    }
    params = result.data as Record<string, unknown>
  }

  return {
    ok: true,
    value: {
      ...(validatedQuery !== undefined ? { validatedQuery } : {}),
      params,
    },
  }
}

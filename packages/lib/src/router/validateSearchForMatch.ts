import type { RouteMatch } from "./types.js"
import type { RouterQuery } from "./requestUrl.js"
import { readPageLoadExport } from "./loaders.js"
import {
  resolveRouteValidation,
  validateRouteInput,
  type RouteValidationFailure,
} from "./loaderValidation.js"

export type SearchValidationFailure = RouteValidationFailure

export { type ValidateSearchResult } from "./searchParams.js"

/** Validate search/params for a matched route before CSR navigation or SSR render. */
export async function validateSearchForMatch(
  match: RouteMatch,
  query: RouterQuery,
  location?: { hash?: string }
): Promise<
  | {
      ok: true
      validatedQuery: Record<string, unknown> | undefined
      params: Record<string, unknown>
    }
  | { ok: false; failure: SearchValidationFailure }
> {
  const mod = await match.route.component()
  const load = readPageLoadExport(mod)
  const validation = resolveRouteValidation(mod, load)
  const result = await validateRouteInput(validation, query, match.params, {
    pathname: match.pathname,
    hash: location?.hash,
  })
  if (!result.ok) {
    return { ok: false, failure: result.failure }
  }
  return {
    ok: true,
    validatedQuery: result.value.validatedQuery,
    params: result.value.params,
  }
}

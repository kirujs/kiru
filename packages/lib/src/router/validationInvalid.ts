/** Result of `validation.onInvalid` (404 or redirect). */
export type ValidationInvalidResult =
  | { kind: "notFound" }
  | { kind: "redirect"; location: string }

/** Passed to `validation.onInvalid` — use `c.notFound()` or `c.redirect(url)`. */
export type ValidationInvalidContext = {
  redirect: (location: string) => ValidationInvalidResult
  notFound: () => ValidationInvalidResult
}

export const validationInvalid: ValidationInvalidContext = {
  redirect: (location) => ({ kind: "redirect", location }),
  notFound: () => ({ kind: "notFound" }),
}

/**
 * Handler for invalid query/params during navigation or SSR.
 * @example `onInvalid: (c) => c.redirect('/search')`
 */
export type ValidationInvalidHandler = (
  ctx: ValidationInvalidContext
) => ValidationInvalidResult

/** Default: `404` when validation fails. */
export const defaultValidationInvalidHandler: ValidationInvalidHandler = (c) =>
  c.notFound()

export function toRouteValidationFailure(
  result: ValidationInvalidResult
): { kind: "notFound" } | { kind: "redirect"; location: string } {
  if (result.kind === "redirect") {
    return { kind: "redirect", location: result.location }
  }
  return { kind: "notFound" }
}

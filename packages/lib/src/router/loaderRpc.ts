import type { LoaderContext } from "./loaders.js"

const LOADER_RPC_BODY_KEYS = [
  "params",
  "url",
  "query",
  "context",
  "meta",
  "route",
  "locale",
  "locales",
  "defaultLocale",
] as const satisfies readonly (keyof LoaderContext)[]

/** Strip non-serializable / server-only fields before client loader RPC POST. */
export function serializeLoaderRpcContext(
  ctx: LoaderContext
): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const key of LOADER_RPC_BODY_KEYS) {
    const value = ctx[key]
    if (value !== undefined) {
      out[key] = value
    }
  }
  return out
}

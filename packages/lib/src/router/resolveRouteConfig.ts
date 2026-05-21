/**
 * Resolve `default` or named `config` from a file-based route config module.
 *
 * Used by generated `routes.gen.ts` so bundlers do not require a named `config`
 * export when authors only use `export default`.
 */
export function resolveRouteConfig<T extends Record<string, unknown>>(
  mod: { default?: T } & Record<string, unknown>
): T {
  const named = mod.config
  if (mod.default !== undefined) return mod.default
  if (named !== undefined && typeof named === "object" && named !== null) {
    return named as T
  }
  return {} as T
}

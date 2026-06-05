# Threadboard API friction log

Notes from building the sandbox on Kiru v2. Format: **wanted** → **workaround** → **suggestion**.

## Resolved during prerequisite work

| Wanted | Workaround | Suggestion |
|--------|------------|------------|
| Svelte-style `optimistic()` on void queries | Was only `withOverride` on instances | Added `listTodos.optimistic()` on void factory |
| `for (const { query } of requested(q)) { query.refresh() }` | Iterator yielded factory (no `.refresh()` on keyed) | `requested()` now yields cache-bound instance |

## Observed while building Threadboard

| Wanted | Workaround | Suggestion |
|--------|------------|------------|
| Share post interceptors across pages | ~~Duplicated sidecar module~~ | Resolved: `export const interceptors` on layout (scope owner) |
| `defineHeadContent` with loader data | `async (ctx) => await ctx.loader()` | Works after runtime head refactor; document as primary pattern |
| Image avatars | Text-only `avatarUrl` field | Wait for v2.1 image pipeline |
| Targeted cache bust on logout | `router.invalidate()` clears all queries | Per-query or per-route invalidation API |
| Form field values in enhance handler | Manual `form.fields` / input names | `.fields.as()` (deferred) |

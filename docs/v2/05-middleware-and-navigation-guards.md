# Middleware and navigation guards

Kiru has **two** extension points for navigation policy:

1. **Route middleware** — framework-level, runs on SSR first paint and CSR navigations (preferred for auth).
2. **Component navigation guards** — CSR-only Vue-router-style hooks (`onBeforeRouteLeave`, etc.).

---

## Route middleware

### Definition

On scopes or routes in the tree:

```typescript
middleware: [
  (ctx) => {
    if (ctx.to.meta.requiresAuth && !ctx.context.user) {
      return { redirect: "/login" }
    }
  },
],
// or layer form:
middleware: (inherited) => [...inherited, myMw],
```

### Context (`RouteMiddlewareContext`)

| Field | Description |
|-------|-------------|
| `to` / `from` | `RouteMiddlewareLocation` — pathname, params, query, hash, href, routeId, meta, segments |
| `context` | `CustomRequestContext` (augmentable) |
| `request` | **`Request` on SSR first paint only** — usually `undefined` on client navigations |

Plan auth accordingly: use hydrated `context` + client-side session signals on navigate; do not rely on reading HttpOnly cookies from `request` in CSR middleware.

### Return values (`RouteMiddlewareResult`)

| Return | SSR (`prepareAppForUrl`) | CSR (`navigation.ts`) |
|--------|--------------------------|------------------------|
| `void` | Continue | Continue |
| `{ redirect }` | 3xx / internal redirect loop | `navigate` to target |
| `{ abort: true }` | Treat as no match / stop | Cancel navigation |
| `{ error: number, body? }` | **HTTP error response** with status/body | **See known issue below** |

### Execution order

`collectMiddlewareChain(match)` — root scope → nested scopes → leaf route, in tree order.

`runRouteMiddleware` (`routeMiddleware.ts`) runs the chain sequentially; first non-void result wins.

SSR may loop redirects up to `MAX_SSR_MIDDLEWARE_REDIRECTS` (16) in `prepareAppForUrl.ts`.

---

## Known issue: CSR middleware `{ error }`

**Server (correct):**

```typescript
// prepareAppForUrl.ts
if (mw.type === "error") {
  return {
    kind: "error",
    status: mw.status,
    body: mw.body,
    headers: mergeResponseHeaders(ctx?.headers),
  }
}
```

**Client (incorrect today):**

```typescript
// navigation.ts — hardcoded redirect
if (mw.type === "error") {
  return runRedirect("/login")
}
```

Any middleware that returns `{ error: 403 }` or `{ error: 503, body: "..." }` on a **client navigation** will redirect to `/login` instead of showing an error page or status-specific handling.

**Launch impact:** High — breaks parity with SvelteKit `error()` / Next middleware response patterns on SPA navigations.

**Recommended fix direction:**

- Render dedicated error outlet / status page from middleware result, or
- Map status to configurable redirect table, or
- Propagate `NavigationFailure` with type `error` and let app handle

**Testing gap:** No e2e covers middleware `{ error }` on CSR; SSR-only if at all.

---

## Component navigation guards (CSR only)

Declared per-component via router runtime registration (`navigationGuards.ts`, `runNavigationGuards.ts`):

| Guard | When |
|-------|------|
| `onBeforeRouteLeave` | Leaving route id |
| `onBeforeRouteUpdate` | Same route id, params changed |
| Enter guards | After commit, entering new route |

Return: `void`, `true`, `false`, or redirect object.

**Not run on SSR.** Types explicitly say to prefer route middleware for auth policy.

### Interaction order (client `navigation.ts`)

1. Leave guards  
2. Update guards  
3. **Route middleware**  
4. Search param validation  
5. History commit  
6. Enter guards  

---

## Search validation (related)

After middleware, `validateSearchForMatch` runs page `validation` schema against query string. Failures can redirect or cancel navigation — separate from middleware but part of the “gate” pipeline.

---

## File-based `middleware.ts`

Codegen imports co-located middleware:

```typescript
// packages/lib/src/router/routeMiddleware.ts
collectRouteMiddlewareModule({ default, middleware })
```

Supports `export default` or `export const middleware` as single function or array.

**E2E:** `e2e/file-routes` — guarded route redirects to `/about`.

---

## Meta for policy

Use `RouteMeta` augmentation:

```typescript
declare module "kiru/router" {
  interface RouteMeta {
    requiresAuth?: boolean
    roles?: string[]
  }
}
```

Set on scopes/routes via `meta` or `page.config.ts`. Middleware reads `ctx.to.meta` (merged along branch via `mergeRouteMeta`).

---

## Comparison to other frameworks

| Framework | Kiru equivalent |
|-----------|-----------------|
| Next `middleware.ts` | No global file — use root scope middleware |
| SvelteKit `hooks.server` | SSR only via adapter `getRequestContext` + route middleware on first paint |
| SvelteKit `handle` redirect | `{ redirect }` |
| Vue Router `beforeEach` | Route middleware + component guards |

---

## Best practices

1. **Auth:** Set session in `getRequestContext` (adapter) → serialize into `CustomRequestContext` → read `ctx.context` in middleware.
2. **403 vs 401:** Do not use `{ error }` on CSR until fixed; use `{ redirect: "/forbidden" }` or client-only guard.
3. **SSR-only checks:** Use `if (ctx.request) { ... }` for cookie/header inspection on first paint; mirror logic on client using stored context after login action refreshes token.
4. **Keep middleware pure** — no DOM access; fast async.

---

## Further reading

- [04-route-tree-and-matching.md](./04-route-tree-and-matching.md)
- [07-remote-actions.md](./07-remote-actions.md) — context token refresh
- [16-gaps-risks-and-launch-checklist.md](./16-gaps-risks-and-launch-checklist.md)

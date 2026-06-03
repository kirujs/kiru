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
| `{ error: number, body? }` | **HTTP error response** with status/body | Commit URL, error outlet, `navigate()` → `errored` |

### Execution order

`collectMiddlewareChain(match)` — root scope → nested scopes → leaf route, in tree order.

`runRouteMiddleware` (`routeMiddleware.ts`) runs the chain sequentially; first non-void result wins.

SSR may loop redirects up to `MAX_SSR_MIDDLEWARE_REDIRECTS` (16) in `prepareAppForUrl.ts`.

---

## CSR middleware `{ error }` (client navigations)

When middleware returns `{ error: status, body? }` on a client navigation:

1. History updates to the **target** URL (parity with SSR: `/forbidden` stays `/forbidden`).
2. `router.navigate()` resolves to `{ status: "errored", error }`.
3. `afterEach` receives `failure: { type: "error", error }` where `error` is a `RouteMiddlewareHttpError`.
4. The matched route’s **error outlet** renders via `outletRenderError` (same path as loader/render failures).

```typescript
import { RouteMiddlewareHttpError } from "kiru/router"

// In an error route module:
export default function Forbidden({ error }: { error: Error }) {
  const status =
    error instanceof RouteMiddlewareHttpError ? error.status : 500
  return <p data-status={status}>{error.message}</p>
}
```

`RouteMiddlewareHttpError` exposes `status` and optional `body`; `error.message` is `body` or `` `HTTP ${status}` ``.

**SSR** still returns the raw status/body from `prepareAppForUrl` (no error route render unless you omit `body` and handle in adapter). **E2E:** `e2e/ssr` `/forbidden` returns 403 with body `Forbidden` on full load.

**CSR client-nav e2e** is tracked separately (S3-2); unit coverage: `navigationMiddlewareError.test.ts`.

---

## Component navigation guards (CSR only)

Declared per-component via router runtime registration (`navigationGuards.ts`, `runNavigationGuards.ts`):

| Guard | When |
|-------|------|
| `onBeforeRouteLeave` | Leaving route id |
| `onBeforeRouteUpdate` | Same route id, params changed |
| Enter guards (`onAfterRouteEnter`) | After commit, entering new route — **side effects only** |

Return: `void`, `true`, or `undefined` are the supported cases. **`false` and redirect returns are ignored** (in development, Kiru logs a one-time console warning). Use leave/update guards or route middleware to cancel or redirect before the URL commits.

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
2. **403 vs 401:** Use `{ error: 403 }` for forbidden UX, or `{ redirect: "/login" }` when a login page is intentional — they are not interchangeable.
3. **SSR-only checks:** Use `if (ctx.request) { ... }` for cookie/header inspection on first paint; mirror logic on client using stored context after login action refreshes token.
4. **Keep middleware pure** — no DOM access; fast async.

---

## Further reading

- [04-route-tree-and-matching.md](./04-route-tree-and-matching.md)
- [07-remote-actions.md](./07-remote-actions.md) — context token refresh
- [16-gaps-risks-and-launch-checklist.md](./16-gaps-risks-and-launch-checklist.md)

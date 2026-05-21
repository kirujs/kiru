# Route middleware, meta, and request context

Unified **policy pipeline** for SSR and CSR replaces the old Vue-style guard zoo (`beforeEach`, `beforeEnter`, etc.). Design notes: [docs/router/route-middleware-and-context.md](../router/route-middleware-and-context.md).

## Route middleware

### Definition

```ts
import type { RouteMiddleware } from "kiru/router"

export const requireAuth: RouteMiddleware = (ctx) => {
  if (!ctx.to.meta.requiresAuth) return
  if (ctx.context.user) return
  const login = ctx.to.meta.unauthorizedRedirect ?? "/login"
  return { redirect: `${login}?next=${encodeURIComponent(ctx.to.href)}` }
}
```

Register app-wide on the **root scope** of `createRouteTree`, or per scope / page via `createRouteScope` / `createRoute` config. With file-based routes, use `middleware.ts` or `scope.config.ts` / `page.config.ts` — see [file-based-routes.md](../router/file-based-routes.md).

### Layer rules (route tree)

Resolved at compile time (same as `meta` / `head`):

- **Array** (or a single handler): replaces the inherited chain from ancestor scopes.
- **Function:** `(inherited) => middleware[]` — extend or replace explicitly.

`collectMiddlewareChain(match)` returns the leaf’s compiled chain (root → leaf order preserved when using layer functions).

### Results

| Return | Effect |
|--------|--------|
| `void` / `undefined` | Continue |
| `{ redirect: string \| { path, replace? } }` | Abort nav; CSR history or SSR 3xx |
| `{ error: 404, body?: "..." }` | HTML error response (SSR) |
| `{ abort: true }` | Silent abort (CSR) |

**Invariant:** middleware runs **before** loaders for that navigation.

## Typed `RouteMeta`

```ts
declare module "kiru/router" {
  interface RouteMeta {
    requiresAuth?: boolean
    unauthorizedRedirect?: string
  }
}
```

Resolved along the scope chain at compile time (object vs function, same as `head`). Use `ctx.to.meta` for the target route and `ctx.from?.meta` for the previous route. Per-scope values are on `ctx.to.segments[].meta`. Use in middleware — not closure state from guards.

## Request context

### SSR — server-provided

```ts
createKiruResponder({
  getRequestContext: async (request) => ({
    user: await loadUserFromCookie(request),
  }),
})
```

Serialized into HTML as `k-request-context` for hydration. `useRequestContext()` reads the provider (and the SSR render slot during sync SSR).

**Remote actions:** `getRequestContext` does not apply to `/?action=` RPC — see [09-actions-and-remote.md](./09-actions-and-remote.md).

### CSR / SSG client

After hydration, `useRequestContext()` returns the hydrated object. Pure CSR without SSR defaults to `{}` in loaders and middleware unless you populate context another way.

`LoaderContext.context` on CSR uses the hydrated value for the lifetime of the page (no client refetch API in v2).

## Future: client session context

Planned: a first-class way to load and refresh `CustomRequestContext` on pure CSR/SSG (session fetch, outlet gating, and related APIs). Not in v2 — design TBD.

## Component navigation guards (CSR-only)

`navigationGuards.ts` — `onBeforeRouteLeave`, etc. for UX (unsaved changes). **Not** run on SSR. Do not use for auth; use route middleware.

## SSR vs old branch behavior

| Old | v2 |
|-----|-----|
| SSR only ran `beforeEnter` | Full middleware chain |
| Guards had no `meta` / `query` | `RouteMiddlewareContext` complete |
| Auth in `beforeEnter` after import | Middleware before `prepareRouteForNavigation` |

# Route middleware and request context

**Status:** Route middleware and SSR request context are shipped in v2. Client-side session loading and outlet gating are **not** — see [Future work](#future-work) below.

Kiru uses a single **route middleware** pipeline on SSR first paint and CSR navigations, driven by typed, merged route `meta`. SSR apps populate `CustomRequestContext` per request; the client hydrates it from `k-request-context`.

## Route middleware

### Definition

```ts
import type { RouteMiddleware } from "kiru/router"

export const requireAuth: RouteMiddleware = (ctx) => {
  if (!ctx.to.meta.requiresAuth) return
  if (ctx.context.user) return
  return { redirect: "/login" }
}
```

Attach on `createRouteTree` / `createRouteScope` / `createRoute`, or via file-based routes (`middleware.ts`, `scope.config.ts`, `page.config.ts`).

### Order

Middleware is resolved at compile time: **arrays replace** the inherited chain from ancestor scopes; **functions** receive that chain and return the next one. The leaf’s compiled chain runs in order (root first when extended via layer functions). Runs **before** loaders for that navigation.

### Results

| Return | Effect |
|--------|--------|
| `void` | Continue |
| `{ redirect }` | Abort; navigate or SSR 3xx |
| `{ error: status, body? }` | HTML error (SSR) |
| `{ abort: true }` | Silent cancel (CSR) |

### Context shape

```ts
type RouteMiddlewareLocation = {
  pathname: string
  params: Record<string, string>
  query: Record<string, string[]>
  hash: string
  href: string
  routeId: string
  meta: RouteMeta // resolved leaf meta for this location
  segments: RouteTreeMatchSegment[]
}

type RouteMiddlewareContext = {
  to: RouteMiddlewareLocation
  from: RouteMiddlewareLocation | null // from.meta is the previous route’s leaf meta
  request?: Request
  context: CustomRequestContext
}
```

Augment `RouteMeta` via module declaration. Leaf meta is resolved at compile time (see route-tree layer rules).

## Request context

### SSR

Provide per-request data with `getRequestContext` on your adapter / renderer. Values are serialized for hydration and available in middleware, loaders, and components via `useRequestContext()`.

### CSR / hydrated client

`useRequestContext()` returns hydrated SSR context when present; otherwise `{}` on pure CSR. There is no `resolveContext` or `refreshContext` on `createRouterApp` in v2.

Loaders use the same context object as middleware for that navigation.

## Future work

- Client session resolution for pure CSR/SSG (API and outlet behavior TBD).
- Any prior design notes for `contextStrategy`, `contextGate`, and `resolveContext` are withdrawn until re-specified.

## Component guards

CSR-only `onBeforeRouteLeave` / similar — UX only, not SSR, not auth.

## See also

- [v2 middleware guide](../v2/04-middleware-meta-context.md)
- [File-based routes](./file-based-routes.md)

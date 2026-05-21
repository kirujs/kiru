# Route middleware, meta, and request context

Unified **policy pipeline** for SSR and CSR replaces the old Vue-style guard zoo (`beforeEach`, `beforeEnter`, etc.). Full design spec: [docs/router/route-middleware-and-context.md](../router/route-middleware-and-context.md).

## Route middleware

### Definition

```ts
import type { RouteMiddleware } from "kiru/router"

export const requireAuth: RouteMiddleware = (ctx) => {
  if (!ctx.meta.requiresAuth) return
  if (ctx.context.user) return
  const login = ctx.meta.unauthorizedRedirect ?? "/login"
  return { redirect: `${login}?next=${encodeURIComponent(ctx.to.href)}` }
}
```

Register app-wide on the **root scope** of `createRouteTree`:

```ts
export const routes = createRouteTree((r) =>
  createRouteScope({
    middleware: [requireAuth, blockUserZero],
    layout: () => import("./layout.tsx"),
    children: [...],
  })
)
```

Per-route / nested scope:

```ts
createRouteScope({
  middleware: [requireAuth],
  meta: { requiresAuth: true },
  children: [...],
})
```

### Execution order

`runRouteMiddleware` (`routeMiddleware.ts`) uses `collectMiddlewareChain` (`routeMeta.ts`):

1. Scope middleware outer → inner (root scope first), then page middleware

### Results

| Return | Effect |
|--------|--------|
| `void` / `undefined` | Continue |
| `{ redirect: string \| { path, replace? } }` | Abort nav; CSR history or SSR 3xx |
| `{ error: 404, body?: "..." }` | HTML error response (SSR) |
| `{ abort: true }` | Silent abort (CSR) |

### Context shape

```ts
type RouteMiddlewareContext = {
  meta: RouteMeta      // merged leaf meta
  to: RouteMiddlewareTo
  from: RouteMiddlewareTo | null
  request?: Request    // SSR first paint; usually undefined on CSR nav
  context: CustomRequestContext
}
```

`to` / `from` include `pathname`, `params`, `query`, `hash`, `href`, `routeId`, `segments`.

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

Shallow merge: child `{ requiresAuth: false }` overrides parent `true`.

Use in middleware — **do not** rely on imperative guards reading closure state.

## Request context

### SSR — server-provided

```ts
createRenderer({
  routes,
  // Per-request object merged into loaders/actions:
})

// Adapter pattern:
createKiruResponder({
  getRequestContext: async (request) => ({
    user: await loadUserFromCookie(request),
  }),
})
```

Serialized into HTML as `k-request-context` for hydration. During **sync** SSR render, `useRequestContext()` also reads the active `runWithSsrRequestContext` slot (cleared after the shell returns).

**Remote actions:** `getRequestContext` does not apply to `/?action=` RPC — those use the signed token from the page that issued the call. Register prod handlers with `import "virtual:kiru:remote-registry"` in `serverEntry` ([09-actions-and-remote.md](./09-actions-and-remote.md)).

### CSR — `resolveContext`

```ts
createRouterApp({
  routes,
  resolveContext: async (event) => {
    if (event.type === "initial") { /* read cookie / storage */ }
    if (event.type === "navigation") { /* maybe refresh */ }
    return { user: ... }
  },
  contextGate: "off", // or "block" app-wide default for inherit scopes
})
```

Events (`types.ts`):

- `{ type: "initial" }`
- `{ type: "navigation", to, from }`
- `{ type: "refresh" }`

`useRequestContext()` reads the reactive provider populated after resolve.

### Loaders and context

`LoaderContext.context` uses:

- SSR: render-time context
- CSR: last resolved context (sticky by default)

**Note:** There is no API to push arbitrary server session changes into loader context after hydration without re-running `resolveContext` or navigating.

## Context gate (`contextStrategy`)

Controls **when** the leaf outlet and loaders run relative to async session fetch.

| Strategy | Outlet | `resolveContext` |
|----------|--------|------------------|
| `none` | Immediate | Not required for gate |
| `background` | Immediate | Runs in parallel; label/UI can update |
| `block` | Waits until `ready` | Required; shows `contextPendingFallback` |
| `inherit` | Uses app `contextGate` (`off` \| `block`) | Depends |

App-level options (`createRouterApp` / `CreateRouterOptions`):

```ts
{
  contextGate: "off",           // default
  contextPendingFallback: () => <AppSpinner />,
  stickyContext: true,        // reuse last context on background/inherit navs
}
```

Scope override example (`e2e/csr/src/context/defineContextRoutes.tsx`):

```ts
createRouteScope({
  contextStrategy: "block",
  contextPendingFallback: () => <ScopeContextPending />,
  meta: { requiresAuth: true, unauthorizedRedirect: "/context/login" },
  middleware: [requireAuth],
  children: [createRoute("/context/admin", () => import("./pages/admin.tsx"))],
}),
```

### Middleware + gate interaction

Recommended pattern for protected admin:

1. `resolveContext` loads session into `CustomRequestContext`
2. `contextStrategy: "block"` prevents flash of protected UI
3. `requireAuth` middleware redirects guests using `ctx.context.user` + `meta`

E2E coverage:

- `e2e/csr/cypress/e2e/context.cy.ts`
- `e2e/ssg/cypress/e2e/context.cy.ts` (client nav after static home)

## Component navigation guards (CSR-only)

`navigationGuards.ts` — `onBeforeRouteLeave`, etc. for UX (unsaved changes). **Not** run on SSR. Do not use for auth; use route middleware.

## SSR vs old branch behavior

| Old | v2 |
|-----|-----|
| SSR only ran `beforeEnter` | Full middleware chain |
| Guards had no `meta` / `query` | `RouteMiddlewareContext` complete |
| Auth in `beforeEnter` after import | Middleware before `prepareRouteForNavigation` |

## Docs site use-case snippets

### Guest-only login page

```ts
meta: { guestOnly: true },
middleware: [(ctx) => {
  if (ctx.context.user) return { redirect: "/dashboard" }
}],
```

### Role gate

```ts
meta: { roles: ["admin"] },
middleware: [(ctx) => {
  if (!ctx.meta.roles?.every(r => ctx.context.roles?.includes(r)))
    return { error: 403 }
}],
```

### Locale + auth

Run i18n detection in SSR renderer before middleware; middleware sees `to.pathname` without locale prefix when using locale routing helpers.

### SSG marketing + CSR app area

Public routes: `contextStrategy: "none"`, `static: true`. App routes: non-static + `background` or `block` + `resolveContext` (see [05-rendering-modes.md](./05-rendering-modes.md)).

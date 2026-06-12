# Route middleware

## Overview

Route middleware runs **before loaders** for a navigation. It can redirect, return HTTP errors, or abort the navigation. Middleware is declared on route tree scopes and leaves, or co-located as `middleware.ts` in file-based route directories.

Middleware operates on URL-level concerns: authentication gates, locale redirects, A/B routing. Component-level **navigation guards** (`onBeforeRouteLeave`, etc.) handle UI-specific blocking — see [navigation-and-guards.md](./navigation-and-guards.md).

---

## How it works

### When middleware runs

| Context | Runs? |
|---------|-------|
| SSR / hybrid first document request | Yes — full chain with `request` present |
| CSR client navigation | Yes — `request` usually undefined |
| Loader execution | After middleware completes without redirect/error/abort |

### Middleware chain

Ancestors run outer → inner. Each scope/route contributes middleware via:

- **Array or single function** — replaces inherited middleware entirely.
- **Layer function** — `(inherited) => [...inherited, myMw]` extends the chain.

```ts
type RouteMiddlewareLayer = (inherited: RouteMiddleware[]) => RouteMiddleware[]
```

### Return values

| Return | Effect |
|--------|--------|
| `void` | Continue to next middleware, then loaders |
| `{ redirect: "/login" }` or `{ redirect: { path, replace? } }` | Abort; navigate to target |
| `{ error: 403, body?: "Forbidden" }` | SSR returns HTTP error; CSR shows error outlet |
| `{ abort: true }` | Silent cancel on CSR (no navigation) |

`RouteMiddlewareHttpError` is thrown internally when middleware returns `{ error }` on the client.

### Context

```ts
type RouteMiddlewareContext = {
  to: RouteMiddlewareLocation    // destination
  from: RouteMiddlewareLocation | null
  request?: Request              // SSR first paint only
  context: CustomRequestContext
}
```

`to.meta` and `to.segments` carry resolved route metadata. Augment `RouteMeta` for typed flags:

```ts
declare module "kiru/router" {
  interface RouteMeta {
    requiresAuth?: boolean
    unauthorizedRedirect?: string
  }
}
```

### File-based routes

A `middleware.ts` in a directory exports a default array or named `middleware` export. `collectRouteMiddlewareModule` normalizes it at build time.

### vs navigation guards

| | Middleware | Guards |
|---|-----------|--------|
| Scope | Route tree / FBR directory | Component (current page) |
| Runs | Before every matching navigation | Leave/update/enter hooks |
| Use for | Auth, redirects, HTTP errors | Unsaved form warnings, per-page logic |

---

## API reference

```ts
import type {
  RouteMiddleware,
  RouteMiddlewareContext,
  RouteMiddlewareResult,
  RouteMiddlewareInput,
  RouteMiddlewareLayer,
  RouteMiddlewareLocation,
  RouteMiddlewareRedirect,
  RouteMiddlewareHttpError,
} from "kiru/router"

import { collectRouteMiddlewareModule, toMiddlewareRedirect } from "kiru/router"
```

```ts
type RouteMiddleware = (
  ctx: RouteMiddlewareContext
) => RouteMiddlewareResult | Promise<RouteMiddlewareResult>

type RouteMiddlewareContext = {
  to: RouteMiddlewareLocation
  from: RouteMiddlewareLocation | null
  request?: Request
  context: CustomRequestContext
}

type RouteMiddlewareLocation = {
  pathname: string
  params: Record<string, string>
  query: Record<string, string[]>
  hash: string
  href: string
  routeId: string
  meta: RouteMeta
  segments: RouteTreeMatchSegment[]
}

type RouteMiddlewareResult =
  | void
  | { redirect: RouteMiddlewareRedirect }
  | { error: number; body?: string }
  | { abort: true }

type RouteMiddlewareRedirect =
  | string
  | { path: string; replace?: boolean }

type RouteMiddlewareInput =
  | RouteMiddleware
  | RouteMiddleware[]
  | RouteMiddlewareLayer

type RouteMiddlewareLayer = (inherited: RouteMiddleware[]) => RouteMiddleware[]

/** Thrown on CSR when middleware returns { error: status }. */
class RouteMiddlewareHttpError extends Error {
  readonly status: number
  readonly body?: string
}
```

Augment `RouteMeta` for typed flags (`requiresAuth`, etc.) — see [routes-and-scopes.md](./routes-and-scopes.md). `CustomRequestContext` is defined in [request-context.md](./request-context.md).

---

## Examples

### Basic — redirect trailing slash

```ts
import type { RouteMiddleware } from "kiru/router"

const stripTrailingSlash: RouteMiddleware = ({ to }) => {
  if (to.pathname !== "/" && to.pathname.endsWith("/")) {
    return { redirect: { path: to.pathname.slice(0, -1), replace: true } }
  }
}
```

```ts
createRouteTree({
  middleware: [stripTrailingSlash],
  children: [/* … */],
})
```

### Intermediate — auth gate with meta

```ts
declare module "kiru/router" {
  interface RouteMeta {
    requiresAuth?: boolean
    unauthorizedRedirect?: string
  }
}

const authMiddleware: RouteMiddleware = ({ context, to }) => {
  if (!to.meta.requiresAuth) return
  if (!context.user) {
    return { redirect: to.meta.unauthorizedRedirect ?? "/login" }
  }
}
```

```ts
createRouteScope({
  meta: { requiresAuth: true, unauthorizedRedirect: "/login" },
  middleware: [authMiddleware],
  children: [
    createRoute("/dashboard", () => import("./pages/dashboard")),
  ],
})
```

### Intermediate — return 403

```ts
const adminOnly: RouteMiddleware = ({ context }) => {
  if (!context.user?.isAdmin) {
    return { error: 403, body: "Admin access required" }
  }
}
```

### Advanced — layered middleware

```ts
const loggingLayer: RouteMiddlewareLayer = (inherited) => [
  ...inherited,
  async ({ to, from }) => {
    console.log(`${from?.pathname ?? "∅"} → ${to.pathname}`)
  },
]

createRouteTree({
  middleware: loggingLayer,
  children: [
    createRouteScope({
      middleware: [authMiddleware],
      children: [/* protected routes */],
    }),
  ],
})
```

### Advanced — locale redirect on server

```ts
const localeRedirect: RouteMiddleware = ({ to, request, context }) => {
  if (!request) return
  const preferred = detectLocaleFromRequest(request, i18nConfig)
  if (preferred !== context.locale) {
    return { redirect: formatPublicHref(to.pathname, preferred) }
  }
}
```

### Advanced — FBR `middleware.ts`

```
pages/
  admin/
    middleware.ts
    dashboard/
      page.tsx
```

```ts
// pages/admin/middleware.ts
import type { RouteMiddleware } from "kiru/router"

export default [
  ({ context, to }) => {
    if (!context.user?.isAdmin) return { redirect: "/" }
  },
] satisfies RouteMiddleware[]
```

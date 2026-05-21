# Route middleware, `meta`, and request context (design spec)

**Status:** Shipped in v2 router (route middleware, `contextStrategy`, CSR `resolveContext`).  
**Audience:** Implementers and reviewers; use this doc as the source of truth when replacing nav guards with a unified cross-environment pipeline.

**Related:**

- Roadmap: [tier-2-framework-parity.md](../router-roadmap/tier-2-framework-parity.md) (request context, middleware)
- Roadmap: [tier-3-differentiation.md](../router-roadmap/tier-3-differentiation.md) (`defineMiddleware` spike)
- Code today: `packages/lib/src/router/navigation.ts`, `runNavigationGuards.ts`, `renderer.ts`, `requestContext.tsx`, `bootstrap/csr.ts`

---

## Summary

Kiru should replace the current Vue Router–style **nav guard zoo** with a single **route middleware** pipeline that runs on **SSR first paint** and **CSR navigations**, driven by **typed, merged route `meta`**. CSR apps need **`resolveContext`** (async) to populate `CustomRequestContext` the same way SSR uses `createRenderer({ context })`. **Protected routes must not render leaf content or run loaders until auth policy is satisfied** — using sync `meta` to gate async context, not the other way around.

---

## Problem: two half-systems today

### Navigation guards (CSR-heavy)

| Hook | CSR | SSR (`createRenderer`) |
|------|-----|-------------------------|
| `router.beforeEach` / `beforeResolve` | Yes | **No** |
| `route.beforeEnter` | Yes | Yes (redirect loop only) |
| `route.beforeActivate` | Yes | **No** |
| `onBeforeRouteLeave` / `Update` / `Enter` | Yes | **No** |

SSR runs only `beforeEnter` before loading the page module (`renderer.ts`). Guards receive a minimal `RouteLocation` — **no `meta`, no `query`, no `request`**:

```ts
export interface RouteLocation {
  pathname: string
  params: Record<string, string>
}
```

### `meta` is compiled but not wired through the navigation path

- Shallow-merged at build time onto `CompiledRoute.meta` (scopes + route) in `manifest.ts`.
- Exposed on **`router.matches`** for breadcrumbs/UI (`csr.ts` → `buildMatchSegments`).
- **Not** passed to guards, **not** in `LoaderContext`, **not** typed via module augmentation (unlike `CustomRequestContext` / `Internationalization`).

Example today (`sandbox/ssr/src/routes.ts`):

```ts
createRoute("/users/[id]", {
  meta: { requiresAuthentication: true },
  beforeEnter: (to) => { /* imperative; meta unused */ },
})
```

`requiresAuthentication` is inert unless manually read inside a guard.

### Three different “middleware” concepts (do not conflate)

| Layer | Where | Purpose |
|-------|--------|---------|
| **HTTP middleware** | Hono/Express/your server only | CORS, logging, rate limits |
| **Route middleware** (this spec) | `routeMiddleware` on router/renderer, after `matchRoute` | Auth, redirects, meta policies |
| **Component hooks** | `onBeforeRouteLeave`, etc. | Unsaved forms, UX confirmations (CSR-only) |

Kiru handlers do not expose HTTP middleware; agnostic rendering stays in the router. Roadmap `defineMiddleware` should align with **route middleware**, not server transport layers.

---

## Recommendation: route middleware + component hooks

### Primary API: **route middleware**

Use the name **middleware** in public docs (SvelteKit/Next familiarity). Keep **guards** only for component-scoped UX hooks.

| Layer | Purpose | Environments |
|-------|---------|----------------|
| **Route middleware** | Auth, redirects, 401/403, meta-driven policy | SSR + CSR |
| **Component hooks** | “Leave page?” / “unsaved changes” | CSR only |
| **HTTP middleware** | Transport / infra | Server adapter only |

### Deprecate / demote over time

| Current | Fate |
|---------|------|
| `router.beforeEach` / `beforeResolve` | Merge into one ordered **global middleware** list |
| `beforeEnter` | Sugar for “entering new `route.id`”; prefer `meta` + shared middleware |
| `beforeActivate` | Too late for auth (runs after dynamic import); remove or niche-only |
| `runGuards` + `false` / redirect | Evolve to `runRouteMiddleware` with richer returns |

---

## Typed `RouteMeta`

```ts
// app.d.ts or routes.ts
declare module "kiru/router" {
  interface RouteMeta {
    requiresAuth?: boolean
    roles?: readonly string[]
    guestOnly?: boolean
    /** Optional: stay on URL with unauthorized shell instead of redirect */
    unauthorizedRedirect?: string
  }
}
```

- `meta` on `r.scope` / `r.page` is `Partial<RouteMeta>`.
- **Shallow merge** along scope chain → leaf route (same as today). Document that child `{ requiresAuth: false }` overrides parent `true`.

### Propagate `meta` everywhere policy runs

| Consumer | Field |
|----------|--------|
| Route middleware | `ctx.meta` (merged) |
| `LoaderContext` | `meta` and/or `route: { id, segments }` |
| `router.matches` | Already has per-segment `meta` slices |

**Invariant:** middleware runs **before** loaders for a route so `serverLoader` / `clientLoader` never run on unauthorized navigations.

---

## Route middleware context and results

### Context (shared SSR + CSR)

```ts
type RouteMiddlewareContext = {
  /** Merged meta: root scope → … → leaf */
  meta: RouteMeta
  to: {
    pathname: string
    params: Record<string, string>
    query: RouterQuery
    hash: string
    href: string
    routeId: string
    segments: RouteTreeMatchSegment[]
  }
  from: typeof to | null
  /** SSR: Request; CSR navigations: usually undefined */
  request?: Request
  /** Same type as loaders / useRequestContext() */
  context: CustomRequestContext
}
```

### Results

```ts
type RouteMiddlewareResult =
  | void // continue
  | { redirect: string | { path: string; replace?: boolean } }
  | { error: number; body?: string } // SSR: Response; CSR: error UI or redirect policy
  | { abort: true } // CSR: cancel navigation
```

Prefer **return-value** style (matches existing `runGuards`) over mandatory `next()` unless we explicitly want SvelteKit-style chaining.

### Registration

**A. Global** — export from routes module or pass to `createRouter` / `createRenderer`:

```ts
export const routeMiddleware = [requireAuth, blockUserZero]
export const routes = createRouteTree(...)
```

**B. Scope inheritance:**

```ts
createRouteScope({
  meta: { requiresAuth: true },
  middleware: [requireAuth],
  children: [...],
})
```

**C. Optional declarative policies** (sugar):

```ts
export const authPolicies = defineMetaPolicies({
  requiresAuth: (ctx) => {
    if (!ctx.context.user) return ctx.redirect("/login")
  },
})
```

---

## Unified pipeline order

Run the **same** `runRouteMiddleware()` from `navigation.ts` (CSR) and `renderer.ts` (SSR).

```
matchRoute
  → locale / invalid-locale handling (existing)
  → effectiveContextStrategy(match) (scope chain; see below)
  → resolveContext (CSR: if shouldResolveContext; SSR: use render context)
  → context gate (shouldBlockOutlet; block until ready when strategy is block)
  → global middleware[]
  → scope middleware[] (ancestor → leaf)
  → route middleware[] (if any)
  → optional meta policies
  → `load.validation` query/params (`validateRouteInput` / `validateSearchForMatch`)
  → redirect loop if path changed
  → loaders
  → render (SSR) or commit URL + outlet (CSR)
```

### SSR mapping

| Result | Behavior |
|--------|----------|
| `redirect` | 302/307 + `Location` (extend existing `beforeEnter` redirect loop) |
| `error: 401` | Short-circuit `Response`, no render |
| `abort` | Document as 403 or 404 |

### CSR mapping

| Result | Behavior |
|--------|----------|
| `redirect` | `navigateInternal` (existing) |
| `error: 401` | Redirect to `/login` (apps can return `redirect` from middleware instead) |
| `abort` | `navigation cancelled` |

**Do not commit navigation** or **dynamic-import protected page modules** until middleware passes for protected targets.

---

## Request context on CSR: `resolveContext`

### Problem

Pure CSR hardcodes `{}` in `createRouterApp` → `RequestContextProvider` and in every `buildLoaderContext` call inside `RouterView`. `meta.requiresAuth` and middleware cannot see `user` without SSR.

### Proposed API

Put on **`createRouter`** (and pass through **`createRouterApp`** from `kiru/router/csr`):

```ts
createRouter({
  routes,
  resolveContext?: (event: ResolveContextEvent) => Promise<CustomRequestContext>
  contextGate?: "off" | "block" // default: off
  contextPendingFallback?: () => JSX.Element
  stickyContext?: boolean // default: true — reuse context on protected→protected nav
})

type ResolveContextEvent =
  | { type: "initial" }
  | { type: "navigation"; to: RouteLocationSnapshot; from: RouteLocationSnapshot | null }
  | { type: "refresh" } // router.refreshContext()
```

Also expose:

```ts
router.refreshContext(): Promise<void>
router.contextState: Signal<"idle" | "pending" | "ready" | "denied">
```

### SSR symmetry

| | SSR | CSR |
|---|-----|-----|
| Source | `render({ context })` per request | `resolveContext(event)` |
| Hydration | `readHydratedRequestContext()` from `k-request-context` script | Skip async resolve on first paint if script present; optional background refresh |
| Components | `useRequestContext()` | Same |
| Loaders | `ctx.context` | Same after gate |

### Security (document clearly)

Client `resolveContext` is for **UX and client loaders only**. Enforcement for secrets and `serverLoader` data remains on the **server**. Never render protected leaf content based on a sync cookie hint alone without async verification.

---

## First-paint flash: the critical pitfall

### Bad outcomes

| Scenario | What users see |
|----------|----------------|
| Direct hit `/dashboard` (CSR refresh) | Dashboard UI → redirect to login (**worst**) |
| Client nav to protected route | Brief protected content or wrong loader data |
| Direct hit `/` (public) | Full-app spinner while `/me` runs (**avoid as default**) |

**Goal:** Never mount the **protected leaf** or run its loaders until auth is resolved or definitively denied. Skeleton / layout chrome is fine; **protected page content is not**.

### Key insight

Split **three** concerns (do not conflate them):

1. **Policy (sync):** `meta.requiresAuth` — what middleware enforces.
2. **Runtime (sync):** `contextStrategy` on scopes — whether to block the outlet and whether to call `resolveContext` on this navigation.
3. **State (async):** `resolveContext()` → `CustomRequestContext` (`idle` / `pending` / `ready` / `denied`).

`requiresAuth: true` does **not** imply “fetch session before painting” — that is `contextStrategy: "block"`. A public landing page can live under `contextStrategy: "none"` and never call `resolveContext` on first paint.

---

## Scope `contextStrategy` (developer control)

Declared on **`createRouteScope()`**; stored on `CompiledRouteScope`. **Nearest scope on the match chain wins** (walk leaf → root; first defined value), else app default (`contextGate` + `inherit`).

```ts
createRouteScope({
  contextStrategy?: "inherit" | "none" | "background" | "block"
  contextPendingFallback?: () => JSX.Element
  meta?: Partial<RouteMeta>
  middleware?: RouteMiddleware | RouteMiddleware[]
  children: ...
})
```

| Strategy | Block outlet? | `resolveContext` |
|----------|---------------|------------------|
| **`inherit`** (default) | Only when `contextGate: "block"`; otherwise use explicit `block` on scopes | Optional background per app when not blocking |
| **`none`** | Never | Never (until `refreshContext()` or a descendant uses `block` / `background`) |
| **`background`** | Never | Yes, non-blocking after paint / on navigation |
| **`block`** | Yes (`contextPendingFallback`) until resolve + middleware pass | Yes, awaited before leaf `import()` / loaders |

**Example — public landing + protected admin (CSR):**

```ts
createRouteScope({
  layout: () => import("./layout.tsx"),
  children: [
    createRouteScope({
      contextStrategy: "none",
      children: [createRoute("/", { component: () => import("./home.tsx") })],
    }),
    createRouteScope({
      contextStrategy: "block",
      contextPendingFallback: () => <p>Checking session…</p>,
      meta: { requiresAuth: true },
      middleware: [requireAuth],
      children: [createRoute("/admin", { component: () => import("./admin.tsx") })],
    }),
  ],
})
```

**Runtime helpers:**

```ts
effectiveContextStrategy(match, appDefault): ContextStrategy
shouldBlockOutlet(match, options): boolean
shouldResolveContext(match, options): boolean
```

**Dev warnings:** `block` without `resolveContext` on `createRouter`.

**`contextState`:** `idle` = never fetched (OK on public `none`); `ready` with `{ user: null }` = definitively logged out — not “still loading”.

---

## Context gate strategies

### A. Scope `contextStrategy` + optional app `contextGate: "block"`

Kiru does **not** ship auth fields on `RouteMeta` or a built-in `requireAuth` middleware — augment `RouteMeta` and add your own middleware (see example below).

1. `matchRoute(url)` (sync).
2. `effectiveContextStrategy(match)` — may be `none` / `background` / `block` from a scope ancestor.
3. **`none`:** render outlet immediately; do not call `resolveContext` unless `refreshContext()`.
4. **`background`:** render immediately; `void resolveContext(...)`; update provider when done (auth-aware chrome only).
5. **`block`:** `pending` outlet; **do not** `import()` leaf or run loaders until `await resolveContext(...)` + middleware pass.
6. **`inherit` + `contextGate: "block"`:** treat like `block` for every route.
7. On pass → load route. On fail → redirect / unauthorized shell **without ever mounting the page component**.

```ts
type ContextGate =
  | { status: "idle" } // public, no auth wait
  | { status: "pending"; reason: "auth" }
  | { status: "ready"; context: CustomRequestContext }
  | { status: "denied"; redirect: string }
```

### B. Hold navigation commit until gate passes

Order: `match → resolveContext (if needed) → middleware → load.validation (query/params) → commit URL → load modules`.

Prevents painting protected content while URL is already `/dashboard` on direct hits.

### C. Pending outlet, not pending whole app

Root layout + nav render immediately; only the **outlet** shows `contextPendingFallback` (app or nearest scope). Same mental model as `serverLoader` `fallback`.

### D. Hydrated context fast path (SSR / SSG)

If `k-request-context` exists:

1. Sync `readHydratedRequestContext()` before first outlet render.
2. Run middleware synchronously for initial match.
3. Optional background `resolveContext({ type: 'refresh' })` — do not flash “logged out” UI while refresh is in flight without an explicit session-invalid signal.

### E. Sync session hint (optional, not sufficient alone)

- e.g. non-httpOnly cookie / localStorage: `hasSessionHint()`.
- If `needsAuth && !hint` → redirect immediately (no dashboard flash).
- If hint → **pending outlet** until `resolveContext` confirms.
- **Never** render protected content from hint alone.

### F. Sticky context on navigation

| Event | Behavior |
|-------|----------|
| public → protected | Gate + pending |
| protected → protected | Reuse context; middleware immediately; background refresh optional |
| protected → public | Render immediately |
| login / logout | `refreshContext()` then re-run middleware on current route |

### G. Inline boot payload for CSR-only SPAs

BFF or dev middleware injects `<script type="application/json" k-request-context">…</script>` (same as SSR). First paint uses sync context; `resolveContext` refreshes after. Good for static host + API.

### H. Unauthorized UX

- **Redirect** to `/login` (OK if no protected DOM was painted).
- Or stay on URL with `unauthorized` route module / `meta.unauthorizedRedirect`.
- Avoid showing `/dashboard` in the address bar **and** dashboard DOM before redirect.

### Recommended default combo

1. Explicit `contextStrategy` on scopes (`none` for marketing, `block` for admin)  
2. Do not load protected chunks until gate passes (B)  
3. `contextPendingFallback` at app or scope level (C)  
4. Hydrated fast path on SSR/SSG (D)  
5. Sticky context on protected→protected nav (F)  
6. Optional session hint (E)  
7. Document inline `k-request-context` for CSR static hosting (G)

### Anti-patterns

- Auth check in page `onMount` or `clientLoader` only (too late; data may leak).
- `block` as default (blank landing on public routes).
- Treat `user: null` the same as “context still loading”.
- Protected routes without `contextStrategy: "block"` when you need zero flash — middleware/meta alone does not block the outlet.
- Calling `resolveContext` on every navigation including public `none` scopes (unnecessary session traffic on landing pages).

### Dev invariant

> Protected leaf components and loaders for `contextStrategy: "block"` routes do not run until `contextGate === 'ready'` and middleware passes.

Add a dev warning if a protected route module is imported before the gate (regression detector).

---

## Example: sandbox-style routes after migration

```ts
// middleware/auth.ts
export const requireAuth: RouteMiddleware = (ctx) => {
  if (ctx.meta.requiresAuth && !ctx.context.user) {
    return {
      redirect: `/login?next=${encodeURIComponent(ctx.to.href)}`,
    }
  }
}

export const blockUserZero: RouteMiddleware = (ctx) => {
  if (ctx.to.params.id === "0") return { redirect: "/about" }
}

// routeMiddleware.ts
export const routeMiddleware = [requireAuth, blockUserZero]

export const routes = createRouteTree((r) =>
  createRouteScope({
    layout: () => import("./pages/layout.tsx"),
    children: [
      createRouteScope({
        contextStrategy: "none",
        children: [createRoute("/", { component: () => import("./pages/index.tsx") })],
      }),
      createRouteScope({
        contextStrategy: "block",
        meta: { requiresAuth: true },
        children: [
          createRoute("/users/[id]", {
            component: () => import("./pages/user.tsx"),
          }),
        ],
      }),
    ],
  })
)

// main.ts (CSR)
createRouterApp({
  routes,
  routeMiddleware,
  resolveContext: async (event) => {
    const res = await fetch("/api/session")
    if (!res.ok) return { user: null }
    return { user: await res.json() }
  },
  contextPendingFallback: () => <p>Checking session…</p>,
})
```

---

## Helpers to implement

```ts
function mergeRouteMeta(match: RouteMatch): RouteMeta
function effectiveContextStrategy(match: RouteMatch, appDefault: ContextGateMode): ContextStrategy
function shouldBlockOutlet(match: RouteMatch, options: ContextGateOptions): boolean
function shouldResolveContext(match: RouteMatch, options: ContextGateOptions): boolean
function runRouteMiddleware(
  manifest: RouteManifest,
  input: { to; from; context; request?; globalMiddleware; ... }
): Promise<RouteMiddlewareResult | "continue">
```

---

## Testing checklist (for implementation PR)

- [ ] Unit: middleware order (global → scope → route), meta merge, redirect loop
- [ ] Unit: `effectiveContextStrategy` — `none` / `block` scopes, `inherit` + `block`
- [ ] Unit: context gate blocks `import()` / loader until `ready` when strategy is `block`
- [ ] E2E CSR: direct visit protected URL — no protected testid in DOM before redirect
- [ ] E2E CSR: public `/` under `contextStrategy: "none"` — no `resolveContext` wait; home renders immediately
- [ ] E2E SSR: same `meta` flag redirects on direct request without leaf HTML
- [ ] E2E SSR hydrate: `k-request-context` + protected route — no second flash on hydrate
- [x] Navigation race: fast double navigation ignores stale `resolveContext` (nav epoch)

---

## Implementation phases (suggested)

### Phase 1 — Foundation

- `RouteMeta` module augmentation
- `contextStrategy` on scopes + `effectiveContextStrategy` / `shouldBlockOutlet` / `shouldResolveContext`
- merged meta on match (via module augmentation)
- `resolveContext` + reactive `RequestContextProvider` on CSR
- Pass real `context` into `buildLoaderContext` (not `{}`)
- `contextStrategy: "block"` on protected scopes + `contextPendingFallback`

### Phase 2 — Middleware pipeline

- `runRouteMiddleware` shared by `navigation.ts` and `renderer.ts`
- Global + scope middleware registration
- Wire `meta` into middleware context and `LoaderContext`
- SSR parity for global middleware (not only `beforeEnter`)

### Phase 3 — DX and migration

- `defineMetaPolicies` (optional)
- Deprecation path for `beforeEach` / `beforeEnter`
- Docs + sandbox/e2e examples
- `router.refreshContext()`, dev warnings

### Phase 4 — Optional

- Session hint (E), inline CSR `k-request-context` (G)
- `stickyContext` tuning, `contextStaleTime`

---

## Open questions (resolve during implementation)

1. **`beforeResolve` equivalent** — needed if we keep async route module resolution before commit, or drop with middleware-only model?
2. **Search validation vs middleware order** — validate query before or after auth redirect?
3. **SSG static pages with `requiresAuth`** — prerender should not embed user data; build-time warning if `static: true` + `requiresAuth` without SSR?
4. **Naming:** `resolveContext` vs `getContext` — prefer `resolveContext` with `event` parameter.
5. **Component hooks** — keep as-is; document as client-only.

---

## References (current code)

| Area | Path |
|------|------|
| CSR bootstrap (`{}` context) | `packages/lib/src/router/bootstrap/csr.ts` |
| Guard pipeline | `packages/lib/src/router/navigation.ts` |
| `runGuards` | `packages/lib/src/router/runNavigationGuards.ts` |
| SSR `beforeEnter` only | `packages/lib/src/router/renderer.ts` (~1154+) |
| Request context | `packages/lib/src/router/requestContext.tsx` |
| Loader context | `packages/lib/src/router/loaders.ts`, `runPageLoad.ts` |
| Meta merge at compile | `packages/lib/src/router/manifest.ts` |
| Component guards | `packages/lib/src/router/navigationGuards.ts` |

# Tier 2 — Framework parity

**Goal:** Match what teams expect from SvelteKit / SolidStart for day-to-day app development: request context everywhere it matters, data invalidation, typed URL state, env, and deployment targets beyond Node.

**Prerequisite:** [Tier 1](./tier-1-release-credibility.md) documentation and routing test baseline.

**Exit criteria:** CSR and SSR apps can implement auth + data mutations without ad-hoc globals; navigations refetch server data intentionally; one non-Node adapter is documented and tested.

---

## Request context (CSR + SSR unified)

- [ ] **`createRouterApp` accepts initial / reactive context** — e.g. `context` signal or `getContext(): CustomRequestContext` passed to loaders on every navigation
- [ ] **`RouterView` / bootstrap use `useOptionalRequestContext()`** for loader `context` instead of `{}`
- [ ] **Update `useRequestContext` docs** — when it throws vs returns `{}`; SSR hydration still strips `k-request-context` script
- [ ] **E2E: loader reads `ctx.user`** on CSR navigation after login (mock context update)
- [ ] **Pattern doc: auth** — set context in server `render({ context })`, refresh client context on session change

## Server loaders on the client

- [ ] **Formalize `/?loader=` RPC for CSR** — enable `__kiru_loaders` in `createRouterApp` when `serverEntry` or explicit `loaders: { secret, allowedOrigins }` option
- [ ] **Wire vite-plugin** — register server loaders in dev middleware for pure CSR + server loader (if product decision: support CSR+API server)
- [ ] **OR: document “server loaders require SSR/SSG first paint”** and enforce dev error instead of silent client invoke
- [ ] **E2E: CSR app with API server** — navigate between two `serverLoader` routes

## Data loading & invalidation

- [ ] **Design: `router.invalidate()`** — refetch loaders for current route or by route id / path pattern
- [ ] **Design: invalidate after `action` / `formAction`** — opt-in `action({ invalidate: ['/users'] })` or callback
- [ ] **Integrate with `resource()`** — document pattern for client-side stale UI (link sandbox `isStale` example)
- [ ] **Optional: navigation `pending` + stale data flag** on router for global loading UX
- [ ] **E2E: mutation then list refresh** without full page reload

## Typed URL state

- [ ] **API design: search param schemas** — `validateSearch` export on page module or route config (Zod/Valibot optional peer)
- [ ] **Parse on navigation** — coerce types, default values, invalid → redirect or 404
- [ ] **SSR: same validation in `createRenderer`** before render
- [ ] **`useRouter().query` typed helpers** or `useSearchParams<T>()` hook
- [ ] **Unit + e2e tests** for invalid query handling

## Route-level HTTP metadata

- [ ] **`export const headers`** or route config `headers(ctx) => HeadersInit` for SSR responses
- [ ] **`export const status`** or dynamic status from loader (404 when data missing)
- [ ] **Cache-Control helpers** — `static: true` routes default to immutable; SSR opt-in `cache: 'no-store'`
- [ ] **Document CDN behavior** for hybrid static files vs SSR paths

## Environment variables

- [ ] **Convention: `kiru/env` or documented Vite pattern** — public vs server-only env
- [ ] **SSR inject public env into HTML** (optional script) for client parity
- [ ] **create-kiru `.env.example`** for each template

## Deployment adapters

- [ ] **`@kiru/adapter-node` or documented Hono preset** — build `dist/server`, static assets, start script
- [ ] **Cloudflare Workers adapter (spike)** — streaming SSR constraints, `prerenderedHtmlDir` → KV/R2 or Assets
- [ ] **Netlify / static adapter** — map SSG output + redirects file generation from route list
- [ ] **Adapter contract doc** — inputs: `RouteManifest`, `clientDir`, `serverEntry`, env

## File-based routing (optional generator)

- [ ] **Spec: `src/pages` → `routes.ts` codegen** — layouts, `[param]`, `[...rest]`, `+page.tsx` naming (pick one convention)
- [ ] **vite-plugin-kiru hook** — `router.fileRoutes: true` generates/virtualizes routes module
- [ ] **Keep `defineRouteTree` as source of truth** — generator is optional; hand-written routes remain supported
- [ ] **create-kiru flag** — `--file-routes` vs manual `routes.ts`

## Forms & actions (SvelteKit-adjacent)

- [ ] **Validation errors from `formAction`** — structured `{ fieldErrors }` JSON; `createFormController` surfaces on `result`
- [ ] **Doc: progressive enhancement** — no-JS submit still works; enhanced path uses fetch
- [ ] **Multiple forms per page** — action id disambiguation (verify current behavior, document)

## Code quality

- [ ] **Shared `prepareRouteForNavigation()`** — used by `RouterView`, `bootstrapSsrClient`, `bootstrapSsgClient`, renderer prep
- [ ] **Reduce duplication** between `csr.tsx` and `routerHydrate.ts` (head sync, load gate, leaf props)
- [ ] **Narrow `@internal` router APIs** — hide `__registerComponentGuard` behind stable hooks only

## Testing

- [ ] **Contract tests for adapters** — minimal app renders `/` and serves static hybrid path
- [ ] **Search params e2e** in `e2e/csr` or `e2e/ssr`
- [ ] **Invalidation e2e** after remote action

---

## Dependencies

| Item | Depends on |
|------|------------|
| Loader invalidation | Stable server loader client transport decision |
| Typed search | Route module export conventions agreed |
| File-based routes | Tier 1 route tests; manifest stability |
| Workers adapter | Streaming renderer audit on Workers |

## Out of scope (Tier 3)

- ISR / on-demand revalidation
- Image optimization component
- Partial prerendering (PPR)

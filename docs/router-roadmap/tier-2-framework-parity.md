# Tier 2 — Framework parity

**Goal:** Match what teams expect from SvelteKit / SolidStart for day-to-day app development: SSR request context, data invalidation, typed URL state, env, and deployment targets beyond Node.

**Prerequisite:** [Tier 1](./tier-1-release-credibility.md) documentation and routing test baseline.

**Exit criteria:** SSR apps can pass per-request context into loaders and actions; navigations refetch server data intentionally; one non-Node adapter is documented and tested.

---

## Request context (documented contract — no client reactive API)

Per-request context is **SSR-only** via `createRenderer({ context })` and hydration (`k-request-context`). Pure CSR/SSG use `{}` in loaders and `useRequestContext()`; there is **no** planned `createRouterApp({ context })` or client-side session sync into loaders.

- [ ] **Document `CustomRequestContext`** — module augmentation, SSR `render({ context })`, hydration script, CSR/SSG `{}` default
- [ ] **Pattern doc: auth** — session in SSR render context; CSR auth UI via `clientLoader` / `action` / client state, not loader context updates on navigations

## Server loaders on the client

- [ ] **Formalize `/?loader=` RPC for CSR** — enable `__kiru_loaders` in `createRouterApp` when `serverEntry` or explicit `loaders: { secret, allowedOrigins }` option
- [ ] **Wire vite-plugin** — register server loaders in dev middleware for pure CSR + server loader (if product decision: support CSR+API server)
- [ ] **OR: document “server loaders require SSR/SSG first paint”** and enforce dev error instead of silent client invoke
- [ ] **E2E: CSR app with API server** — navigate between two `serverLoader` routes

## Data loading & invalidation

- [x] **`router.invalidate()`** — refetch loaders for current route; optional `routeIds` filter; `loaderEpoch` + outlet reload
- [x] **Invalidate after `action`** — `action({ invalidate: ['route-id'] })` + `x-kiru-invalidate` response header
- [ ] **Integrate with `resource()`** — document pattern for client-side stale UI (link sandbox `isStale` example)
- [ ] **Optional: navigation `pending` + stale data flag** on router for global loading UX
- [x] **E2E: mutation then list refresh** without full page reload (`invalidate-demo`)

## Typed URL state

- [x] **Search param schemas** — `load.validation.query` on `loader` / `serverLoader` / `clientLoader`; legacy `validateSearch` via `defineSearchParams`; [Standard Schema](https://standardschema.dev) + `parse` / `safeParse` (`@standard-schema/spec` optional peer)
- [x] **Parse on navigation** — defaults, `onInvalid` → 404 or redirect, `redirectToCanonical`
- [x] **SSR: same validation in `createRenderer`** before render (`validateRouteInput`)
- [x] **`useSearchParams<T>()`** — validated query signal on the router
- [x] **Unit + e2e tests** — `loaderValidation.test.ts`, `search-schema` e2e

## Route-level HTTP metadata

- [x] **`export const headers`** — `defineRouteHeaders` static or `(ctx) => HeadersInit`
- [x] **`export const status`** — number or function from loader context / page props
- [x] **`export const cache`** — `'no-store' | 'immutable'`; static routes default to immutable
- [ ] **Document CDN behavior** for hybrid static files vs SSR paths

## Environment variables

- [ ] **Convention: `kiru/env` or documented Vite pattern** — public vs server-only env
- [ ] **SSR inject public env into HTML** (optional script) for client parity
- [ ] **create-kiru `.env.example`** for each template

## Deployment adapters

- [x] **`@kirujs/adapter-contract`** — `KiruResponse`, `KiruHandle`, `toWebResponse`, `composeRespond`
- [x] **`@kirujs/adapter-node`** — `createKiruResponder`, `resolveStatic`, hybrid ISR; Node bridge (`nodeRequestToFetch`, `sendKiruResponse`)
- [x] **HTTP frameworks** — mix-and-match via `kiru.handle` + userland catch-all ([`deploy-runtimes.md`](../router/deploy-runtimes.md))
- [x] **`@kirujs/adapter-bun`** — `createKiruBunServer`, `Bun.serve`
- [x] **`@kirujs/adapter-cloudflare` (thin)** — Worker handler, immutable Assets prerender, no ISR
- [x] **`@kirujs/runtime` + adapter contract** — [`deploy-runtimes.md`](../router/deploy-runtimes.md)
- [ ] **Netlify / static adapter** — map SSG output + redirects file generation from route list

## File-based routing (optional generator)

- [ ] **Spec: `src/pages` → `routes.ts` codegen** — layouts, `[param]`, `[...rest]`, `+page.tsx` naming (pick one convention)
- [ ] **vite-plugin-kiru hook** — `router.fileRoutes: true` generates/virtualizes routes module
- [ ] **Keep `defineRouteTree` as source of truth** — generator is optional; hand-written routes remain supported
- [ ] **create-kiru flag** — `--file-routes` vs manual `routes.ts`

## Forms & actions (SvelteKit-adjacent)

- [x] **Validation errors from `formAction`** — structured `{ fieldErrors }` JSON; `createFormController` surfaces on `result`
- [ ] **Doc: progressive enhancement** — no-JS submit still works; enhanced path uses fetch (e2e covers SSR forms)
- [ ] **Multiple forms per page** — action id disambiguation (verify current behavior, document)

## Code quality

- [x] **Shared `prepareRouteForNavigation()`** — `RouterView`, `bootstrapSsrClient`, renderer prep
- [x] **`createSsrRouterShell()`** — shared SSR/SSG shell; `routerHydrate` uses inline outlet for targeted updates
- [ ] **Further dedupe** between `csr.tsx` and `routerHydrate.ts` (head sync, load gate, leaf props)
- [ ] **Narrow `@internal` router APIs** — hide `__registerComponentGuard` behind stable hooks only

## Testing

- [x] **Contract tests for adapters** — `adapter-contract`, Node bridge (`adapter-node`); full SSR e2e remains `e2e/ssr`
- [x] **Search params e2e** — `e2e/ssr` `search-schema`
- [x] **Invalidation e2e** — `invalidate-demo` after remote action

---

## Dependencies

| Item | Depends on |
|------|------------|
| Loader invalidation | Stable server loader client transport decision |
| Typed search | Route module export conventions agreed |
| File-based routes | Tier 1 route tests; manifest stability |
| Workers adapter | Streaming renderer audit on Workers |

## Out of scope (Tier 3) — historical

These were Tier 3 targets; wave 1 delivered ISR, `<Image>`, and PPR-lite. See [tier-3-wave-1.md](../router/tier-3-wave-1.md) and [kiru-image.md](../router/kiru-image.md).

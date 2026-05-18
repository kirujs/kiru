# Changelog

All notable changes to this project will be documented in this file.

## Unreleased

### Deploy adapters

- **`@kirujs/runtime`:** `KiruDeployTarget`, `getRuntimeCapabilities`, `assertISRAllowed` — shared contract for adapters and `vite-plugin-kiru`.
- **`@kirujs/adapter-node`:** `createKiruHandler` (Web `fetch`), `composeFetch`, `serveKiruNode` (Node HTTP, no Hono), `resolveStatic`, hybrid ISR, optional runtime image optimizer. Optional Hono: `@kirujs/adapter-node/hono` (`createKiruHono`).
- **`@kirujs/adapter-bun`:** `createKiruBunServer`, `serveKiruBun` — same `fetch` handler as Node via `Bun.serve` (no Hono dependency).
- **`@kirujs/adapter-cloudflare`:** `createKiruWorkerHandler` — SSR + **immutable** prerender from Assets; **no ISR** on edge (Next.js-style).
- **`createRenderer({ deployTarget })`:** edge target ignores disk ISR; Web Crypto action tokens on Cloudflare.
- **`vite-plugin-kiru` `router.adapter`:** `node` | `bun` | `cloudflare` — worker SSR bundle, `wrangler.toml.generated`, ISR warnings for edge.
- **Guide:** [`docs/router/deploy-runtimes.md`](docs/router/deploy-runtimes.md). E2E: `e2e/ssr-bun`, `e2e/ssr-worker`.

### Router

- **Tier 3 wave 1:** Hybrid ISR via `export const isr = defineISR({ revalidate, tags, dynamic })` (legacy separate exports still read); `PrerenderCacheStore` (disk + memory) with SSG sidecar metadata; `revalidatePath` / `revalidateTag` and `action({ revalidate })` meta; stale-while-revalidate single-flight; loader `staleTime` / `gcTime` with background refetch and `router.isLoaderStale`; `Link` `locale` prop; `defineSiteConfig` `locales` + hreflang sitemaps; guide at [`docs/router/tier-3-wave-1.md`](docs/router/tier-3-wave-1.md).
- **Image pipeline:** `Image` component (`kiru`) and `kiru/image` (`getImageProps`, `defineImageConfig`); build-time variants via Vite `router.images`; runtime `createImageOptimizer` / `createImageOptimizerIfRuntime` for `strategy: 'runtime'`; SSR preload registry; e2e CSR/SSG/SSR — see [`docs/router/kiru-image.md`](docs/router/kiru-image.md).
- **Tier 2 parity:** [Standard Schema](https://standardschema.dev) validation via `Schema` and async `parseInput` (Zod 3/4+, Valibot, `{ parse }` / `{ safeParse }`); `router.invalidate()` and action-driven invalidation (`invalidate` route ids, `x-kiru-invalidate` header); route `headers` / `status` / `cache` SSR exports; shared `prepareRouteForNavigation` and `createSsrRouterShell` (targeted outlet updates on loader refetch); CSR/SSG dev guards for remote `action` / `formAction` dispatch.
- **Loaders:** `validation: { query, params, onInvalid, queryDefaults, redirectToCanonical }` on `loader` / `serverLoader` / `clientLoader` — typed `query` / `params` in loader context, `queryDefaults` checked against the query schema, optional canonical URL redirect when defaults apply; legacy `export const validateSearch` still supported.
- **Hooks:** `useSearchParams<T>()` returns validated query when `load.validation.query` is configured.
- **Routing:** Fix optional segment `[[param]]` pattern compilation so `/blog` matches without an extra slash; add optional catch-all `[[...param]]` compilation and matching; add unit coverage for catch-all, optional segments, `baseUrl` / `trailingSlash`, and ambiguous route scoring ([`manifest-routing.test.ts`](packages/lib/src/tests/unit/manifest-routing.test.ts)).
- **Rendering:** Fix function-component child vnode indices in `headlessRender` (SSR stream vs hydration alignment); skip static-DOM hosts in `createVNodeId` so hydration container indices match SSR.
- **DX:** Dev-only warnings when `RouterView` is mounted on SSR/SSG HTML without the correct bootstrap, when `serverLoader` runs without loader RPC, and when `staticLoader` is invoked on client navigations.
- **Refactors:** Extract client navigation pipeline to [`navigation.ts`](packages/lib/src/router/navigation.ts) and prerender disk short-circuit to [`prerenderServe.ts`](packages/lib/src/router/prerenderServe.ts) (behavior unchanged).
- **E2E:** SSR invalidate-after-action, search-schema validation, form-action progressive enhancement and redirect flows; hybrid `/docs` disk HTML assertion.

### Remote / forms

- **Actions:** `action.post(schema, handler)` validates with `parseInput`; optional `action({ invalidate: ['route-id'] })` refetches matching loaders after success.
- **Fix:** `createFormController` sends `x-kiru-form` so enhanced submissions receive JSON (including redirects) instead of native 303 responses; structured `fieldErrors` on validation failure.
- **Tests:** Unit coverage for Standard Schema / `parseInput`, loader validation, route response headers, form-action redirect handling (enhanced JSON and native `303`).

### Dependencies

- `@standard-schema/spec` is an optional peer (and dev dependency for Kiru tests); no runtime requirement on a specific validator library.

### Known limitations

- `serverLoader` on client navigations requires `kiru/router/ssr`, `createRenderer`, and a server loader endpoint (`/?loader=`). Pure CSR/SSG apps should use `loader`, `clientLoader`, or `staticLoader`.
- `CustomRequestContext` is `{}` on pure CSR/SSG. Per-request values are SSR-only via `createRenderer({ context })`; there is no client reactive context API for loaders.
- Loader invalidation after actions is opt-in via route ids; global stale-data UX (`pending` + stale flag) is not implemented yet.

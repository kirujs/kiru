# Changelog

All notable changes to this project will be documented in this file.

## Unreleased

### Deploy adapters

- **`@kirujs/runtime`:** `KiruDeployTarget`, `getRuntimeCapabilities`, `assertISRAllowed` — shared contract for adapters and `vite-plugin-kiru`.
- **`@kirujs/adapter-contract`:** `KiruHandle` (`Response | null`, `null` = not handled), `toFetchHandler`, `composeRespond`.
- **`@kirujs/adapter-node`:** `createKiruResponder` / `createKiruHandler` (`handle` + `fetch`), `toNodeListener`, hybrid ISR, static assets; `nodeRequestToFetch` → `{ request, abort }`, `bindClientDisconnectAbort`, abort-aware `writeNodeResponse`.
- **`@kirujs/adapter-cloudflare`:** `createKiruWorkerHandle` (`Response | null`) and `createKiruWorkerHandler` (Web `fetch`).
- **HTTP frameworks:** no separate packages — mix runtime adapter + explicit catch-all in your app ([`deploy-runtimes.md`](docs/router/deploy-runtimes.md)).
- **`@kirujs/adapter-bun`:** `createKiruBunServer`, `serveKiruBun` — same `fetch` handler as Node via `Bun.serve` (no Hono dependency).
- **`@kirujs/adapter-cloudflare`:** `createKiruWorkerHandler` — SSR + **immutable** prerender from Assets; **no ISR** on edge (Next.js-style).
- **`createRenderer({ deployTarget })`:** edge target ignores disk ISR; Web Crypto action tokens on Cloudflare.
- **`vite-plugin-kiru` `router.adapter`:** `node` | `bun` | `cloudflare` — worker SSR bundle, `wrangler.toml.generated`, ISR warnings for edge.
- **Guide:** [`docs/router/deploy-runtimes.md`](docs/router/deploy-runtimes.md). E2E: `e2e/ssr-matrix` (13 adapter smoke cells); removed legacy `e2e/ssr-bun` / `e2e/ssr-worker` (covered by `bun-*` / `worker-*` matrix cells).

### Router

- **Tier 3 wave 1:** Hybrid ISR via `export const isr = defineISR({ revalidate, tags, dynamic })` (legacy separate exports still read); `PrerenderCacheStore` (disk + memory) with SSG sidecar metadata; `revalidatePath` / `revalidateTag` and `action({ revalidate })` meta; stale-while-revalidate single-flight; loader `staleTime` / `gcTime` with background refetch and `router.isLoaderStale`; `Link` `locale` prop; `defineSiteConfig` `locales` + hreflang sitemaps; guide at [`docs/router/tier-3-wave-1.md`](docs/router/tier-3-wave-1.md).
- **Image pipeline:** `Image` component (`kiru`) and `kiru/image` (`getImageProps`, `defineImageConfig`); build-time variants via Vite `router.images`; runtime `createImageOptimizer` / `createImageOptimizerIfRuntime` for `strategy: 'runtime'`; SSR preload registry; e2e CSR/SSG/SSR — see [`docs/router/kiru-image.md`](docs/router/kiru-image.md).
- **Tier 2 parity:** [Standard Schema](https://standardschema.dev) validation via `Schema` and async `parseInput` (Zod 3/4+, Valibot, `{ parse }` / `{ safeParse }`); `router.invalidate()` and action-driven invalidation (`invalidate` route ids, `x-kiru-invalidate` header); route `headers` / `status` / `cache` SSR exports; shared `prepareRouteForNavigation` and `createSsrRouterShell` (targeted outlet updates on loader refetch); CSR/SSG dev guards for remote `action` dispatch (including `action.post({ type: "form" }, …)`).
- **Loaders:** `validation: { query, params, onInvalid, queryDefaults, redirectToCanonical }` on `loader` / `serverLoader` / `clientLoader` — typed `query` / `params` in loader context, `queryDefaults` checked against the query schema, optional canonical URL redirect when defaults apply.
- **Breaking:** Removed `validateSearch` / `defineSearchParams`, `KiruValidator`, and `assertValid`. Use `load.validation` and `Schema` + `parseInput` only.
- **Link prefetch:** `prefetch={{ trigger, chunks, data }}` with optional `/?loader=` data warmup via `kiru/router/loaderClient`; hover on `pointerenter` + `mouseenter`; `serverLoader` uses client cache for prefetch + click dedupe when `staleTime: 0`.
- **Breaking — context gate removed:** Dropped `resolveContext`, `contextGate`, `contextStrategy`, `contextPendingFallback`, and outlet deferral. CSR/SSG use hydrated `CustomRequestContext` only; client session loading is deferred.
- **File-based routes:** `scope.config.ts` and `{page}.config.ts` (`RouteScopeConfig` / `RoutePageConfig`) merged into generated `createRouteTree` / `createRoute` calls.
- **Loader cache:** pathname-scoped entries cleared when navigating away; `staleTime: 0` skips background revalidate loops; single-flight stale refetch when `staleTime > 0`.
- **Refactors:** `prepareAppForUrl.ts`, `ssrAppBuild.ts`, `staticRouteRender.ts`, `renderErrorRecovery.ts`, `prerenderRegenerate.ts`, `clientRoutePrep.ts`, `buildLoaderContextForMatch`, `rendererStream.ts`, `resolveSsrRouteModule`; router internals in `routerRuntime.ts` (no public `__*` fields); codegen imports `kiru/router/loaderRegistry`.
- **Hooks:** `useSearchParams<T>()` returns validated query when `load.validation.query` is configured.
- **Routing:** Fix optional segment `[[param]]` pattern compilation so `/blog` matches without an extra slash; add optional catch-all `[[...param]]` compilation and matching; add unit coverage for catch-all, optional segments, `baseUrl` / `trailingSlash`, and ambiguous route scoring ([`manifest-routing.test.ts`](packages/lib/src/tests/unit/manifest-routing.test.ts)).
- **Rendering:** Fix function-component child vnode indices in `headlessRender` (SSR stream vs hydration alignment); skip static-DOM hosts in `createVNodeId` so hydration container indices match SSR.
- **DX:** Dev-only warnings when `RouterView` is mounted on SSR/SSG HTML without the correct bootstrap, when `serverLoader` runs without loader RPC, and when `staticLoader` is invoked on client navigations.
- **Refactors:** Extract client navigation pipeline to [`navigation.ts`](packages/lib/src/router/navigation.ts) and prerender disk short-circuit to [`prerenderServe.ts`](packages/lib/src/router/prerenderServe.ts) (behavior unchanged).
- **E2E:** SSR invalidate-after-action, search-schema validation, form-action progressive enhancement and redirect flows; hybrid `/docs` disk HTML assertion; `/context-concurrency` + `scripts/concurrent-request-context.mjs` for parallel per-request context isolation.

### Remote / forms

- **Breaking — unified `action.post`:** Removed `formAction` and positional `action.post(schema, handler)` / `action.post(handler, meta)`. Use `action.post({ type: "form" }, handler)` for forms; `action.post({ schema, invalidate, revalidate }, handler)` for JSON with config; bare `action.post(handler)` for simple JSON RPC.
- **Breaking — action handler context:** `action.get` / `action.post` callbacks receive **`RemoteActionContext`** `{ context, signal }` instead of bare `CustomRequestContext`. Use `context.user` (etc.) where you previously used `ctx.user`. Zero-arg handlers are unchanged. Client calls may pass `{ signal }` (GET last arg, POST second arg); the server forwards `Request.signal` into the handler. Aborted RPCs return **499**. SSR sets context only during **sync** `runWithSsrRequestContext`; RPC uses the token, not that slot.
- **Actions:** `action.post({ schema }, handler)` validates with `parseInput`; `{ invalidate }` / `{ revalidate }` on the same config object refetch loaders or prerender cache after success.
- **Fix:** `createFormController` sends `x-kiru-form` so enhanced submissions receive JSON (including redirects) instead of native 303 responses; structured `fieldErrors` on validation failure.
- **Tests:** Unit coverage for Standard Schema / `parseInput`, loader validation, route response headers, form-action redirect handling (enhanced JSON and native `303`), action abort (499) and `RemoteActionContext` injection.

### Abortable navigation and rendering

- **CSR:** Each `navigate()` aborts the previous navigation’s `AbortController` and bumps `navToken`; `NavigationScope` gates loader cache commits and stale background refetch so fast double-navigation cannot apply stale props.
- **SSR action scope:** Single `current` scope (`runWithSsrRequestContext`) around `headlessRender` only — no ALS; do not await inside the scope callback.
- **Loaders:** `LoaderContext.signal` is **required**; `loaderSignalFromRequest`, `staticLoaderSignal`, and `runWithPrerenderSignal` for SSG builds.
- **SSR:** `prepareAppForUrl` honors `request.signal`; aborted renders return `null` (not 500) when loader work is discarded or the request is cancelled mid-prepare.
- **SSG:** `prerenderStaticRoutes({ signal })` and Vite prerender **SIGINT** cooperative abort between pages; **`maxConcurrentRenders: Infinity`** now runs paths in parallel (was incorrectly sequential).
- **Node adapter:** `nodeRequestToFetch` returns `{ request, abort }`; `bindClientDisconnectAbort` + `writeNodeResponse(..., signal)` cancel in-flight SSR when the client disconnects. `toNodeListener` wires this automatically.
- **Tests:** `navigationAbort`, `ssrAbort`, `ssgAbort`, and extended `navigationScope` / `loaderStale` coverage.

### Dependencies

- `@standard-schema/spec` is an optional peer (and dev dependency for Kiru tests); no runtime requirement on a specific validator library.

### Known limitations

- `serverLoader` on client navigations requires `kiru/router/ssr`, `createRenderer`, and a server loader endpoint (`/?loader=`). Pure CSR/SSG apps should use `loader`, `clientLoader`, or `staticLoader`.
- `CustomRequestContext` is `{}` on pure CSR/SSG. Per-request values are SSR-only via `createRenderer({ context })`; there is no client reactive context API for loaders.
- Loader invalidation after actions is opt-in via route ids; global stale-data UX (`pending` + stale flag) is not implemented yet.
- Abort is cooperative: long-running loaders and actions must respect `signal` (or check `signal.aborted`) to stop promptly.
- Production SSR must `import "virtual:kiru:remote-registry"` in `serverEntry` when using `router.remote` (dev loads it automatically).
- Migrating remote actions: see [`docs/v2/14-migration-from-main.md`](docs/v2/14-migration-from-main.md#remote-action-handler-context) and [`docs/v2/09-actions-and-remote.md`](docs/v2/09-actions-and-remote.md).

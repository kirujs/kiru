# Loaders and page data

Loaders supply **page props before mount** — no loading spinner in the default path. Pages use `PageProps<typeof load>` and optional `usePageData()`.

Source: `packages/lib/src/router/loaders.ts`, `runPageLoad.ts`, `prepareRoute.ts`.

## Loader kinds

| Export helper | `__kiruLoader` | Runs where (first paint) | Client navigation |
|---------------|----------------|--------------------------|-------------------|
| `loader()` | `universal` | SSR server (or SSG build) + can run on client | Re-runs per staleTime |
| `serverLoader()` | `server` | SSR / SSG build only | SSR: `POST /?loader=` RPC; client cache when `staleTime: 0` (see below) |
| `clientLoader()` | `client` | CSR only | Always client |
| `staticLoader()` | `static` | SSG build → baked into module | **Does not run** (warn in dev) |

## Page module pattern

```ts
import { clientLoader, type PageProps } from "kiru/router"

export const load = clientLoader(async () => ({
  source: "client",
  message: "from clientLoader",
}))

export default function ClientLoaderPage({ data, error }: PageProps<typeof load>) {
  return () => (
    <div>
      <p data-testid="loader-data">
        {error ? error.message : `${data.source}:${data.message}`}
      </p>
    </div>
  )
}
```

Real fixture: `e2e/csr/src/pages/loaders/client.tsx`.

### `serverLoader` with streaming fallback (SSR)

```ts
export const load = serverLoader({
  load: async () => fetchExpensive(),
  fallback: () => <p data-testid="loader-fallback">Loading…</p>,
})
```

Used for PPR-lite streaming (`e2e/ssr` `/loaders/server-immediate-shell`). Requires `kiru/router/ssr` + running server.

### `staticLoader` (SSG)

```ts
export const load = staticLoader(async () => ({
  source: "static",
  message: "prerendered loader data",
}))
```

Fixture: `e2e/ssg/src/pages/loaders-static.tsx`.

## `staticLoader` bake (branch change)

Previously static loader output was primarily embedded in HTML. Now the SSG build also writes per-path data into the page chunk:

```ts
// Generated at build time on the page module:
export const __kiruStaticLoaderPayload: Record<string, unknown> = {
  "/loaders/static": { source: "static", message: "..." },
}
```

Runtime lookup: `resolveStaticLoaderDataFromModule` in `staticLoaderData.ts` keys by `pathname + search`.

**Implication for docs:** rebuilding SSG is required after loader logic changes; missing export triggers `[kiru/router] Page module is missing __kiruStaticLoaderPayload`.

## `LoaderContext`

Every loader receives:

```ts
interface LoaderContext {
  params: Record<string, string>
  url: { pathname: string; search: string; hash: string }
  query: RouterQuery
  context: CustomRequestContext  // {} on CSR until resolveContext fills client state
  meta: RouteMeta               // merged route meta
  route: { id: string }
  request?: Request              // SSR first paint
  signal: AbortSignal            // navigation / request / prerender cancel
  locale?: string                // when i18n enabled
}
```

Cooperative abort: check `signal.aborted` or use `throwIfAborted(signal)` from `kiru/router` (see navigation scope). SSG builds use `runWithPrerenderSignal` / `prerenderStaticRoutes({ signal })`.

Augment `CustomRequestContext` for typed `context.user`, etc.

## Validation (Standard Schema)

```ts
import { z } from "zod"
import { loader } from "kiru/router"

export const load = loader({
  validation: {
    query: z.object({ page: z.coerce.number().default(1) }),
    params: z.object({ id: z.string() }),
    onInvalid: "error", // or redirect
    queryDefaults: { page: 1 },
    redirectToCanonical: true,
  },
  load: async ({ query, params }) => ({ ... }),
})
```

- Typed `query` / `params` in loader + `useSearchParams<T>()`
- `parseInput` with `Schema` (Zod, Valibot, Standard Schema)

E2E: SSR Cypress search-schema tests.

## Loader caching (Tier 3)

```ts
export const load = serverLoader({
  staleTime: 30_000,  // ms until stale (default 0 = always refetch nav)
  gcTime: 300_000,    // cache retention (default 5 min)
  load: async () => ({ items: [] }),
  fallback: () => <p>Loading…</p>,
})
```

CSR API:

- `router.invalidate()` — force refetch
- `router.isLoaderStale` — UI flag while showing cached data past `staleTime` during background revalidate (`staleTime > 0` only)

**`staleTime: 0` (default):** entries are served from cache for the current pathname without background revalidate loops. Use this for **Link prefetch dedupe** (hover warms cache; the next click to the same route skips a second RPC). When you **navigate away**, the router clears cache entries for the **previous** pathname so returning later refetches.

**`staleTime > 0`:** stale entries trigger a single-flight background refetch; `onCacheRefreshed` bumps `loaderEpoch` when fresh data lands.

See `packages/lib/src/router/loaderCache.ts` and `docs/router/tier-3-wave-1.md`.

## Hydration and `useHydratedPageData`

On SSR/SSG first paint, `bootstrapSsrClient` calls `prepareRouteForNavigation` with `useHydratedPageData: true` so loaders read `<script k-page-data>` instead of re-fetching.

After hydrate, navigations use `useHydratedPageData: false` (except invalidation / `forceReload`).

## Dev guards

| Warning / error | Trigger |
|-----------------|--------|
| `serverLoader` on CSR/SSG bootstrap | `guardServerLoaderOnClient` |
| `serverLoader` without `__kiru_loaders` | SSR hydrate but no server |
| `staticLoader` on client navigation | `warnStaticLoaderOnClientNavigation` |
| Wrong bootstrap on SSR HTML | `warnRouterViewWithoutSsrBootstrap` |

## `PageProps` and errors

```ts
type PageProps<L> = {
  data: LoaderData<L>
  error?: Error
}
```

Validation failures and loader throws surface as `error` without crashing the router shell (route-level `error` modules still apply for render throws).

## Loader registry (SSR RPC)

`vite-plugin-kiru` with `router.serverEntry` emits `virtual:kiru:loader-registry`. Generated server bundles import `__INTERNAL_LOADER_REGISTRY` from **`kiru/router/loaderRegistry`** (not the public `kiru/router` barrel). Server handles:

```
POST /?loader=<routeId>:load
Body: serialized LoaderContext JSON (LoaderContext.url.pathname is the matched route pathname)
Header: x-kiru-token (signed context)
```

Client stub: `__kiruEnsureLoaderDispatch()` from `kiru/router/loaderClient` (installed on SSR/SSG hydrate and CSR bootstrap).

## Link prefetch

`<Link>` accepts `prefetch` as `false` or `{ trigger?: "hover" | "visible", chunks?: boolean, data?: boolean }`. Default when omitted: `{ trigger: "hover", chunks: true, data: true }` when loader RPC exists.

Hover prefetch runs on **`pointerenter` and `mouseenter`** (synthetic `mouseenter` in tests still triggers prefetch).

- **chunks** (default `true`): dynamic-import route modules (layouts + page) when the context gate allows.
- **data** (default `true` when `__kiru_loaders` RPC is present): validates search params, then warms loader cache via `/?loader=` or client/universal loaders. **`serverLoader`** results are cached like other kinds when `staleTime: 0`; the next navigation to that pathname reuses the cache (one RPC for hover + click).
- Prefetch does **not** run middleware, `resolveContext`, or full navigation — it only reduces latency for the next click.

Protected routes with `contextStrategy: "block"` skip leaf module import until the gate is ready (same as `RouterView`).

E2E: `e2e/ssr/cypress/e2e/ssr.cy.ts` — hover on `/loaders/server` link, assert a single `POST /?loader=` before and after click.

## Use-case examples for docs site

### Public marketing data — `staticLoader` + SSG

Build-time fetch, CDN-deployed HTML, fast LCP. Pair with `static: true` routes.

### Authenticated dashboard — `serverLoader` + SSR

Sensitive data never in static bundle; client navigations refetch via RPC.

### Browser-only APIs — `clientLoader` + CSR

Geolocation, `localStorage`, no server.

### Shared fetch — `loader` (universal)

Same function runs on server (first paint) and client (navigations) — good for public APIs with short `staleTime`.

### Mutation refresh

```ts
// After action.post success with meta:
action.post(schema, handler, { invalidate: ["route:products-list"] })
```

Or `router.invalidate()` manually.

### Search params table

```ts
export const load = loader({
  validation: { query: searchSchema },
  load: async ({ query }) => listPosts(query),
})

// In component:
const params = useSearchParams<typeof load>()
```

## Anti-patterns

| Don't | Do instead |
|-------|------------|
| `serverLoader` in CSR-only app | `loader` or `clientLoader` |
| `staticLoader` for live counters | `loader` + `staleTime` or SSR |
| `kiru/router/csr` on prerendered HTML | `kiru/router/ssg` or `ssr` |
| Expect loader on protected route before auth | Middleware + `contextStrategy: "block"` first |

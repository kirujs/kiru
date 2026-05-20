# ISR, prerender cache, and PPR-lite

Build-time static HTML plus **optional** runtime cache/regeneration — hybrid ISR (Tier 3 wave 1). User-facing guide: [docs/router/tier-3-wave-1.md](../router/tier-3-wave-1.md).

## Page export: `defineISR`

```ts
import { defineISR } from "kiru/router"

// Default hybrid: serve fresh prerender, stale-while-revalidate, SSR fallback
export const isr = defineISR({
  revalidate: 60,
  tags: ["blog"],
})

// Build output required; 404 if HTML missing at request time
export const isr = defineISR({
  dynamic: "force-static",
  revalidate: 60,
  tags: ["blog"],
})

// Always SSR — ignore disk prerender for this route
export const isr = defineISR({ dynamic: "force-dynamic" })
```

Read from page module via `readRouteISRExport` (`routeRevalidate.ts`).

## Production disk serve

When `prerenderedHtmlDir` or `prerenderCache` is set and `NODE_ENV === "production"`:

1. Match route
2. If `dynamic !== "force-dynamic"`, try `tryServePrerenderedFromDisk`
3. On stale TTL → return stale HTML + background regen (single-flight)
4. On miss + `force-static` → 404
5. Else fall through to SSR

**Development:** disk never read when using hybrid — avoids stale build overriding live SSR.

## `PrerenderCacheStore`

Default: `diskPrerenderCache({ clientDir, pathPolicy, staticPaths })` — files under client dir + sidecar metadata for TTL/tags.

Memory store available for tests. `setGlobalPrerenderCache` wires `revalidatePath` / `revalidateTag`.

## On-demand revalidation

Server-only exports:

```ts
import { revalidatePath, revalidateTag } from "kiru/router"

await revalidatePath("/docs")
await revalidateTag("blog")
```

Trigger from `action.post` metadata:

```ts
action.post(schema, handler, {
  revalidate: { paths: ["/docs"], tags: ["blog"] },
})
```

## Cache-Control

Numeric `revalidate` seconds map to `s-maxage` + `stale-while-revalidate` headers on prerender responses (`cachePolicyToHeaders`).

`revalidate: false` → immutable build output (Cloudflare Workers model).

## PPR-lite (streaming holes)

Not React Server Components — loader streaming only.

| Pattern | Mechanism |
|---------|-----------|
| Static shell + async data | `serverLoader({ load, fallback })` + static `pageHead` |
| Force SSR on static route | `static: true` + `defineISR({ dynamic: "force-dynamic" })` |
| Prerender-only | `defineISR({ dynamic: "force-static" })` |

**E2E routes** (`e2e/ssr`):

| Route | Demonstrates |
|-------|----------------|
| `/ppr/force-dynamic` | HTML on disk but every request SSR (loader counter increments) |
| `/ppr/force-static` | 404 in prod without prerender output |
| `/loaders/server-immediate-shell` | Streaming fallback UI |

Cypress: `e2e/ssr/cypress/e2e/tier3-wave1.cy.ts`.

## SSG build pipeline

`vite-plugin-kiru` `closeBundle`:

1. Client Vite build completes
2. `prerenderStaticRoutes({ routes, htmlTemplate, i18n, maxConcurrentRenders })`
3. Writes `path.html` / `path/index.html` + `404.html` (if configured)
4. Static loader bake emits `__kiruStaticLoaderPayload` on page chunks
5. If `serverEntry`, bundle SSR server separately

Concurrency: `router.ssg.build.maxConcurrentRenders` (default **10**). Pass **`Infinity`** to render all static paths in parallel (`Promise.all`). Finite values use a worker pool.

**Build abort:** `prerenderStaticRoutes({ signal })` stops scheduling further pages; Vite SSG hooks forward **SIGINT** to the same signal between pages (`runWithPrerenderSignal`).

## `generateStaticPaths`

Only routes with `static: true` in manifest. Expanded by:

- `generateStaticParams` on page modules
- i18n: `generatePublicStaticPaths` adds locale prefixes

Used by:

- SSG build
- Hybrid disk serve gate (SSR won't serve wrong disk file for non-static routes)
- Sitemap (base set)

## Edge (Cloudflare) constraints

`getRuntimeCapabilities("cloudflare").isr === false`

- No time-based revalidate / SWR regen on Workers
- **Supported:** immutable prerender in Assets + `force-dynamic` SSR
- Plugin warns when page exports incompatible ISR

## `tryReadPrerenderedHtml` safety

Won't return Vite shell `index.html` with `{{kiru_body}}` placeholders unless path is in `staticPaths` set — prevents leaking empty shell for SSR-only apps.

## Use-case examples

### Marketing docs + dynamic app (hybrid)

```ts
r.page("/docs", { static: true, component: () => import("./docs.tsx") })
r.page("/app/[...path]", { component: () => import("./app.tsx") })
```

Vite: `ssg` + `serverEntry`. Deploy: Node adapter with `prerenderedHtmlDir`.

### Blog with hourly regen

```ts
export const isr = defineISR({ revalidate: 3600, tags: ["blog"] })
```

```ts
action.post(schema, async ({ context, signal }, input) => {
  if (signal.aborted) throw new DOMException("Aborted", "AbortError")
  await savePost(input, { authorId: context.user?.id })
}, { revalidate: { tags: ["blog"] } })
```

### CDN immutable + SSR API

Cloudflare: prerender build to Assets; API routes `dynamic: "force-dynamic"`.

### Local dev expectations

Document clearly: **hybrid disk behavior is production-only**; dev SSR matches pure SSR app for static routes.

## Monitoring stale-serving

Background regen sets `bypassPrerenderServe` while `renderCore` regenerates entry into cache (`renderer.ts` `onRegenerate` callback).

Single-flight: concurrent stale requests share one regen promise (`prerenderServe.ts`).

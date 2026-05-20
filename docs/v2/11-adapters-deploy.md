# Adapters and deployment

Kiru returns **`Response | null`** from route handlers. Adapters bridge Web `fetch` to Node, Bun, and Cloudflare — they do not own HTTP middleware.

## Contract (`@kirujs/adapter-contract`)

```ts
type KiruHandle = (request: Request) => Promise<Response | null>

// null → not handled (404 or your fallthrough)
toFetchHandler(handle, { notFound })
composeRespond(middleware, handle)  // wrap handle chain
```

## Node / Bun (`@kirujs/adapter-node`, `@kirujs/adapter-bun`)

```ts
import { createKiruResponder, toNodeListener } from "@kirujs/adapter-node"
import { createServer } from "node:http"
import { routes } from "./routes"

const kiru = createKiruResponder({
  importMetaUrl: import.meta.url,
  routes,
  stream: true,
  prerenderedHtmlDir: undefined, // default: resolved clientDir in prod
  routeMiddleware: [requireAuth],
  getRequestContext: async (req) => ({ user: await loadUser(req) }),
  actions: { secret: process.env.KIRU_ACTIONS_SECRET!, allowedOrigins: ["*"] },
  image: { config: imageConfig, sharp },
})

export default { fetch: kiru.fetch }

createServer(toNodeListener(kiru)).listen(3000)
```

`createKiruResponder` wraps `createRenderer` + static asset middleware + optional runtime image optimizer.

### Options highlights

| Option | Purpose |
|--------|---------|
| `clientDir` / `resolveStatic` | `dist/client` resolution |
| `prerenderedHtmlDir: false` | Disable hybrid disk |
| `serveStaticAssets` | `/assets/*` from client build (default prod true) |
| `deployTarget` | `"node"` \| `"bun"` |

### HTTP frameworks

Register API routes **before** Kiru catch-all:

```ts
app.all("*", async (c) => {
  const out = await kiru.handle(c.req.raw)
  if (out === null) return c.notFound()
  return out
})
```

Examples: Hono, Express (`nodeRequestToFetch` / `writeNodeResponse`), Fastify, Elysia — see [docs/router/deploy-runtimes.md](../router/deploy-runtimes.md).

## Cloudflare Workers (`@kirujs/adapter-cloudflare`)

```ts
createKiruWorkerHandle({
  routes,
  htmlTemplate,
  getAsset,
  assetFetch,
  stream: true,
})
```

- Serves **immutable** prerender from Assets binding first
- SSR for dynamic routes
- **No** time-based ISR / `revalidateTag` on edge
- Images: `defineImageConfig({ strategy: "build" })` only

`run_worker_first = true` in Wrangler so `/` hits worker SSR, not raw shell `index.html`.

## Runtime capabilities

```ts
import { getRuntimeCapabilities } from "@kirujs/runtime"

getRuntimeCapabilities("node")   // { isr: true, runtimeImages: true, ... }
getRuntimeCapabilities("cloudflare") // { isr: false, ... }
```

Used by vite-plugin ISR checks and adapter feature gates.

## `Response | null` semantics

| Return | Adapter behavior |
|--------|------------------|
| `Response` | Kiru handled (HTML, asset, image, action, loader) |
| `null` | Pass to next handler / default 404 |

Enables mounting Kiru under `/app` prefix or combining with API routers.

## E2E SSR matrix

`e2e/ssr-matrix/` — same minimal fixture, 13 cells:

| Target | Servers |
|--------|---------|
| Node | fetch, Hono, Express, Fastify, Elysia |
| Bun | fetch, Hono, Express, Fastify, Elysia |
| Cloudflare | worker smoke |

Scripts: `scripts/matrix.mjs`, `run-cell.mjs`, `smoke-core.mjs`.

Docs: [docs/router/e2e-ssr-matrix.md](../router/e2e-ssr-matrix.md).

## Deploy recipes (docs site)

### Docker Node hybrid

1. `vite build`
2. Copy `dist/client` + `dist/server`
3. `ENV NODE_ENV=production`
4. `node dist/server/index.js`
5. CDN can cache prerender HTML paths with `Cache-Control` from ISR

### Static SSG only

1. `vite build` with `ssg: true` only
2. Upload `dist/` to R2/S3
3. Configure SPA fallback for non-prerendered paths

### Bun native

```ts
import { createKiruBunServer, serveKiruBun } from "@kirujs/adapter-bun"
serveKiruBun(kiru, { port: 3000 })
```

### Workers + Assets

Build with `adapter: "cloudflare"`; upload client assets; worker `fetch` delegates to `createKiruWorkerHandle`.

## Environment variables (convention)

| Variable | Used for |
|----------|----------|
| `KIRU_ACTIONS_SECRET` | Action token signing |
| `NODE_ENV` | Prerender disk gate |
| `PORT` | Server listen |

## What adapters deliberately omit

- Session stores
- CORS (use framework)
- Database pools
- Automatic HTTPS

Keeps Kiru **bring your own server** aligned with roadmap positioning.

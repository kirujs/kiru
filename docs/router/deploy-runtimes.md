# Deploy runtimes (Node, Bun, Cloudflare Workers)

Kiru’s router renders to a **`KiruResponse`** (status, headers, body) or returns **`null`** when it does not handle the request. You wire HTTP in your framework; Kiru does not register catch-all routes for you.

## Choose a runtime adapter

| Runtime | Package | ISR (time + tags) | Runtime images (`sharp`) | Typical use |
|---------|---------|-------------------|--------------------------|-------------|
| Node | `@kirujs/adapter-node` | Yes | Yes | VPS, Docker, `node dist/server` |
| Bun | `@kirujs/adapter-bun` | Yes (same as Node) | Yes | `bun run dist/server` |
| Cloudflare Workers | `@kirujs/adapter-cloudflare` | **No** | No (use `strategy: 'build'`) | Edge SSR + immutable static HTML |

Shared types and helpers: `@kirujs/adapter-contract` (`KiruResponse`, `toWebResponse`, `toFetchHandler`, `composeRespond`).

## `KiruResponse | null`

| `handle(request)` returns | Meaning |
|---------------------------|---------|
| `KiruResponse` | Kiru handled the request (SSR, static asset, image, prerender hit) |
| `null` | No match — **your** policy: 404, fall through, or another handler |

Runtime adapters expose:

```ts
const kiru = createKiruResponder({ ... }) // Node/Bun
// kiru.handle(request) → Promise<KiruResponse | null>
// kiru.fetch(request)  → Web fetch (null → 404 by default)
```

For `export default { fetch }` or `Bun.serve`, use `kiru.fetch`. For Hono, Fastify, Express, etc., call `kiru.handle` in your own catch-all and convert the result.

## ISR on edge (not supported)

Following the same product boundary as **Next.js on Edge**, Kiru does **not** support on Workers:

- Time-based `revalidate: N` and stale-while-revalidate background regen
- `revalidatePath` / `revalidateTag` / `action({ revalidate })`

**Supported on Workers:**

- Build-time SSG (`router.ssg`) uploaded to **Assets** (or similar)
- **Immutable** prerender (`revalidate: false` or no TTL) served read-only before SSR
- `dynamic: 'force-dynamic'` for fully dynamic routes

Configure `router.adapter: 'cloudflare'` in `vite-plugin-kiru` to emit a worker bundle and warn on incompatible ISR exports.

## Node / Bun quick start (no HTTP framework)

```ts
import { createKiruResponder, serveKiruNode } from "@kirujs/adapter-node"
import { routes } from "./routes"

const isProd = process.env.NODE_ENV === "production"
const kiru = createKiruResponder({
  importMetaUrl: import.meta.url,
  dev: !isProd,
  stream: true,
  routes,
  actions: { secret: process.env.KIRU_ACTIONS_SECRET!, allowedOrigins: ["*"] },
})

export default { fetch: kiru.fetch }

if (isProd) serveKiruNode(kiru)
```

Bun: `createKiruBunServer` from `@kirujs/adapter-bun` (same `KiruResponder`, `deployTarget: "bun"`).

### Custom middleware

`createKiruResponder` accepts `middleware: KiruRespondMiddleware[]` (outermost first). Each layer receives `next(): Promise<KiruResponse | null>`. Use `composeRespond` from `@kirujs/adapter-contract` for fetch-native layers (logging, auth).

### Node Request/Response bridge

For Express, Fastify, or raw `node:http`, import from `@kirujs/adapter-node`:

- `nodeRequestToFetch(req)` — `IncomingMessage` → Web `Request`
- `sendKiruResponse(res, kiru)` — `KiruResponse` → `ServerResponse`
- `sendFetchToNodeResponse(res, response)` — Web `Response` → `ServerResponse`
- `toWebResponse(kiru)` — `KiruResponse` → Web `Response` (from `@kirujs/adapter-contract`)

## HTTP frameworks (mix and match)

Pick a **runtime** package, then write the catch-all yourself so you can log, auth, or fall through when `handle` returns `null`.

Register **API routes first**, then Kiru.

### Hono (Node / Bun / Workers)

```ts
import { createKiruResponder } from "@kirujs/adapter-node"
import { toWebResponse } from "@kirujs/adapter-contract"
import { Hono } from "hono"
import { routes } from "./routes"

const kiru = createKiruResponder({ importMetaUrl: import.meta.url, routes, stream: true })

const app = new Hono()
app.get("/api/health", (c) => c.json({ ok: true }))

app.all("*", async (c) => {
  const kiruOut = await kiru.handle(c.req.raw)
  if (kiruOut === null) return c.notFound()
  return toWebResponse(kiruOut)
})

export default { fetch: app.fetch }
```

### Express

```ts
import { createKiruResponder, nodeRequestToFetch, sendKiruResponse } from "@kirujs/adapter-node"
import express from "express"
import { routes } from "./routes"

const kiru = createKiruResponder({ importMetaUrl: import.meta.url, routes, stream: true })

const app = express()
app.get("/api/health", (_req, res) => res.json({ ok: true }))

app.use(async (req, res) => {
  const kiruOut = await kiru.handle(nodeRequestToFetch(req))
  if (kiruOut === null) {
    res.status(404).send("Not Found")
    return
  }
  await sendKiruResponse(res, kiruOut)
})

app.listen(process.env.PORT ?? 3000)
```

### Fastify

```ts
import { createKiruResponder, nodeRequestToFetch, sendKiruResponse } from "@kirujs/adapter-node"
import Fastify from "fastify"
import { routes } from "./routes"

const kiru = createKiruResponder({ importMetaUrl: import.meta.url, routes, stream: true })

const fastify = Fastify()
fastify.get("/api/health", async () => ({ ok: true }))

fastify.all("*", async (request, reply) => {
  const kiruOut = await kiru.handle(nodeRequestToFetch(request.raw))
  if (kiruOut === null) {
    reply.code(404).send("Not Found")
    return
  }
  await sendKiruResponse(reply.raw, kiruOut)
})

await fastify.listen({ port: Number(process.env.PORT) || 3000 })
```

### Elysia (Node / Bun)

```ts
import { createKiruBunServer } from "@kirujs/adapter-bun"
import { toWebResponse } from "@kirujs/adapter-contract"
import { Elysia } from "elysia"
import { routes } from "./routes"

const kiru = createKiruBunServer({ importMetaUrl: import.meta.url, routes, stream: true })

const app = new Elysia()
  .get("/api/health", () => ({ ok: true }))
  .all("*", async ({ request }) => {
    const kiruOut = await kiru.handle(request)
    if (kiruOut === null) return new Response("Not Found", { status: 404 })
    return toWebResponse(kiruOut)
  })

export default { fetch: app.fetch }
```

## Cloudflare Workers quick start

```ts
import {
  createKiruWorkerHandler,
  createKiruWorkerHandle,
  assetsBindingToGetAsset,
  toWebResponse,
} from "@kirujs/adapter-cloudflare"
import { routes } from "./routes"

export interface Env {
  ASSETS: { fetch: typeof fetch }
}

let handle: ReturnType<typeof createKiruWorkerHandle> | null = null

async function getHandle(env: Env) {
  if (handle) return handle
  const tplRes = await env.ASSETS.fetch(
    new Request("https://assets.local/index.html")
  )
  const htmlTemplate = await tplRes.text()
  const assetFetch = (req: Request) => env.ASSETS.fetch(req)
  handle = createKiruWorkerHandle({
    routes,
    htmlTemplate,
    stream: true,
    getAsset: assetsBindingToGetAsset(assetFetch),
    assetFetch,
  })
  return handle
}

export default {
  async fetch(request: Request, env: Env) {
    const kiruHandle = await getHandle(env)
    const kiruOut = await kiruHandle(request)
    if (kiruOut === null) return new Response("Not Found", { status: 404 })
    return toWebResponse(kiruOut)
  },
}
```

`createKiruWorkerHandler` remains available when you want a single `(request) => Response` with default 404 behavior.

Set `defineImageConfig({ strategy: "build" })` for edge deploys.

**Wrangler Assets:** enable `run_worker_first = true` so `/` is SSR-rendered instead of serving the raw `index.html` shell. Pass `assetFetch: (req) => env.ASSETS.fetch(req)` so `/assets/*` still resolves.

## Capability matrix

See `@kirujs/runtime` — `getRuntimeCapabilities(target)` is the single source of truth used by adapters and the Vite plugin.

## Migration from manual Hono

Replace manual `createRenderer` + static middleware with `createKiruResponder` from `@kirujs/adapter-node`. Use `resolveStatic` when you only need paths without the full handler.

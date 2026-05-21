# Deploy runtimes (Node, Bun, Cloudflare Workers)

Kiru's router returns a Web **`Response`** or **`null`** when it does not handle the request. You wire HTTP in your framework; Kiru does not register catch-all routes for you.

## Choose a runtime adapter

| Runtime | Package | ISR (time + tags) | Runtime images (`sharp`) | Typical use |
|---------|---------|-------------------|--------------------------|-------------|
| Node | `@kirujs/adapter-node` | Yes | Yes | VPS, Docker, `node dist/server` |
| Bun | `@kirujs/adapter-bun` | Yes (same as Node) | Yes | `bun run dist/server` |
| Cloudflare Workers | `@kirujs/adapter-cloudflare` | **No** | No (use `strategy: 'build'`) | Edge SSR + immutable static HTML |

Shared types and helpers: `@kirujs/adapter-contract` (`toFetchHandler`, `composeRespond`).

## `Response | null`

| `handle(request)` returns | Meaning |
|---------------------------|---------|
| `Response` | Kiru handled the request (SSR, static asset, image, prerender hit) |
| `null` | No match — **your** policy: 404, fall through, or another handler |

Runtime adapters expose:

```ts
const kiru = createKiruResponder({ ... }) // Node/Bun
// kiru.handle(request) → Promise<Response | null>
// kiru.fetch(request)  → Web fetch (null → 404 by default)
```

For `export default { fetch }` or `Bun.serve`, use `kiru.fetch`. For Hono, Fastify, Express, etc., call `kiru.handle` in your own catch-all and return or forward the `Response`.

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
import { createServer } from "node:http"
import { createKiruResponder, toNodeListener } from "@kirujs/adapter-node"
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

if (isProd) {
  const port = Number(process.env.PORT) || 3000
  createServer(toNodeListener(kiru)).listen(port)
}
```

Bun: `createKiruBunServer` from `@kirujs/adapter-bun` (same `KiruResponder`, `deployTarget: "bun"`). Use `Bun.serve({ fetch: kiru.fetch })` or `serveKiruBun(kiru)` instead of `createServer` when you prefer Bun's server.

### Route middleware (auth, redirects)

Register app-wide middleware on the **`createRouteTree` root scope** (same for CSR, SSR, and adapters). See [route-middleware-and-context.md](./route-middleware-and-context.md). CORS, logging, and other HTTP concerns belong in your server framework, not the Kiru handler.

To wrap `kiru.handle` yourself (e.g. logging), use `composeRespond` from `@kirujs/adapter-contract` around the returned `handle`.

### Node Request/Response bridge

For Express, Fastify, or raw `node:http`, import from `@kirujs/adapter-node`:

- `nodeRequestToFetch(req)` — `IncomingMessage` → `{ request, abort }` (Web `Request` with `signal`, plus an `AbortController` you can link to the response)
- `bindClientDisconnectAbort(res, abort)` — aborts in-flight SSR when the client closes the connection early
- `writeNodeResponse(res, response, renderSignal?)` — Web `Response` → `ServerResponse` (cancels the body reader when `renderSignal` aborts)
- `toNodeListener(handler)` — `KiruResponder` or `KiruFetch` → Node request listener (wires the above automatically)

## HTTP frameworks (mix and match)

Pick a **runtime** package, then write the catch-all yourself so you can log, auth, or fall through when `handle` returns `null`.

Register **API routes first**, then Kiru.

### Hono

Catch-all wiring is the same on every runtime. Use each runtime's **first-class HTTP adapter** to listen in production:

| Runtime | Listen in production |
|---------|----------------------|
| Node | [`@hono/node-server`](https://hono.dev/getting-started/nodejs) `serve({ fetch: app.fetch, port })` |
| Bun | `Bun.serve({ fetch: app.fetch, port })` or `export default { fetch: app.fetch }` |
| Workers | `export default { fetch: app.fetch }` (or your framework worker `fetch`) |

**Node + Hono:**

```ts
import { createKiruResponder } from "@kirujs/adapter-node"
import { serve } from "@hono/node-server"
import { Hono } from "hono"
import { routes } from "./routes"

const kiru = createKiruResponder({ importMetaUrl: import.meta.url, routes, stream: true })

const app = new Hono()
app.get("/api/health", (c) => c.json({ ok: true }))
app.all("*", async (c) => {
  const kiruOut = await kiru.handle(c.req.raw)
  if (kiruOut === null) return c.notFound()
  return kiruOut
})

export default { fetch: app.fetch }

if (process.env.NODE_ENV === "production") {
  serve({ fetch: app.fetch, port: Number(process.env.PORT) || 3000 })
}
```

**Bun / Workers** — same `app` routes; swap the production listen line for `Bun.serve` or a Worker export.

### Express and Fastify (Node / Bun)

Express and Fastify have no published fetch-native listen adapter yet (the in-progress `@fastify/fetch` is not on npm). Use Kiru's Node bridge helpers on the catch-all:

- `nodeRequestToFetch(req)` — `IncomingMessage` → `{ request, abort }`
- `bindClientDisconnectAbort(res, abort)` — cooperative abort on client disconnect
- `writeNodeResponse(res, response, abort.signal)` — stream body with abort-aware cancellation

### Express

```ts
import {
  bindClientDisconnectAbort,
  createKiruResponder,
  nodeRequestToFetch,
  writeNodeResponse,
} from "@kirujs/adapter-node"
import express from "express"
import { routes } from "./routes"

const kiru = createKiruResponder({ importMetaUrl: import.meta.url, routes, stream: true })

const app = express()
app.get("/api/health", (_req, res) => res.json({ ok: true }))

app.use(async (req, res) => {
  const { request, abort } = nodeRequestToFetch(req)
  const unbind = bindClientDisconnectAbort(res, abort)
  try {
    const kiruOut = await kiru.handle(request)
    if (kiruOut === null) {
      res.status(404).send("Not Found")
      return
    }
    await writeNodeResponse(res, kiruOut, abort.signal)
  } finally {
    unbind()
  }
})

app.listen(process.env.PORT ?? 3000)
```

### Fastify

```ts
import {
  bindClientDisconnectAbort,
  createKiruResponder,
  nodeRequestToFetch,
  writeNodeResponse,
} from "@kirujs/adapter-node"
import Fastify from "fastify"
import { routes } from "./routes"

const kiru = createKiruResponder({ importMetaUrl: import.meta.url, routes, stream: true })

const fastify = Fastify()
fastify.get("/api/health", async () => ({ ok: true }))

fastify.all("*", async (request, reply) => {
  const { request: kiruReq, abort } = nodeRequestToFetch(request.raw)
  const unbind = bindClientDisconnectAbort(reply.raw, abort)
  try {
    const kiruOut = await kiru.handle(kiruReq)
    if (kiruOut === null) {
      reply.code(404).send("Not Found")
      return
    }
    await writeNodeResponse(reply.raw, kiruOut, abort.signal)
  } finally {
    unbind()
  }
})

await fastify.listen({ port: Number(process.env.PORT) || 3000 })
```

### Elysia

| Runtime | Adapter | Listen in production |
|---------|---------|----------------------|
| Node | [`@elysiajs/node`](https://elysiajs.com/integrations/node) `adapter: node()` + `.listen(port)` | `app.listen(port)` |
| Bun | default Bun adapter | `app.listen(port)` or `export default { fetch: app.fetch }` |
| Workers | `CloudflareAdapter` + `.compile()` | Worker `fetch` delegates to `app.fetch(request)` |

**Node + Elysia:**

```ts
import { createKiruResponder } from "@kirujs/adapter-node"
import { node } from "@elysiajs/node"
import { Elysia } from "elysia"
import { routes } from "./routes"

const kiru = createKiruResponder({ importMetaUrl: import.meta.url, routes, stream: true })

const app = new Elysia({ adapter: node() })
  .get("/api/health", () => ({ ok: true }))
  .all("*", async ({ request }) => {
    const kiruOut = await kiru.handle(request)
    if (kiruOut === null) return new Response("Not Found", { status: 404 })
    return kiruOut
  })

export default { fetch: app.fetch }

if (process.env.NODE_ENV === "production") {
  app.listen(Number(process.env.PORT) || 3000)
}
```

**Bun** — use `createKiruBunServer` instead of `createKiruResponder`; omit `node()` (Bun is the default adapter).

## Cloudflare Workers quick start

```ts
import {
  createKiruWorkerHandler,
  createKiruWorkerHandle,
  assetsBindingToGetAsset,
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
    return kiruOut
  },
}
```

`createKiruWorkerHandler` remains available when you want a single `(request) => Response` with default 404 behavior.

Set `defineImageConfig({ strategy: "build" })` for edge deploys.

**Wrangler Assets:** enable `run_worker_first = true` so `/` is SSR-rendered instead of serving the raw `index.html` shell. Pass `assetFetch: (req) => env.ASSETS.fetch(req)` so `/assets/*` still resolves.

## E2E coverage

CI can exercise the same SSR fixture across runtimes and HTTP framework wiring. See [E2E SSR matrix](./e2e-ssr-matrix.md) for the planned `e2e/ssr-matrix` package, smoke tiers, and valid matrix cells.

## Capability matrix

See `@kirujs/runtime` — `getRuntimeCapabilities(target)` is the single source of truth used by adapters and the Vite plugin.

## Migration from manual Hono

Replace manual `createRenderer` + static middleware with `createKiruResponder` from `@kirujs/adapter-node`. Use `resolveStatic` when you only need paths without the full handler.

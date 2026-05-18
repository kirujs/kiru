# Deploy runtimes (Node, Bun, Cloudflare Workers)

Kiru’s router is **fetch-native**: `createRenderer().render(request)` returns a Web `Response`. Deploy adapters wire paths, static assets, and runtime-specific constraints.

## Choose an adapter

| Adapter | Package | ISR (time + tags) | Runtime images (`sharp`) | Typical use |
|---------|---------|-------------------|--------------------------|-------------|
| Node | `@kirujs/adapter-node` | Yes | Yes | VPS, Docker, `node dist/server` |
| Bun | `@kirujs/adapter-bun` | Yes (same as Node) | Yes | `bun run dist/server` |
| Cloudflare Workers | `@kirujs/adapter-cloudflare` | **No** | No (use `strategy: 'build'`) | Edge SSR + immutable static HTML |

## ISR on edge (not supported)

Following the same product boundary as **Next.js on Edge**, Kiru does **not** support on Workers:

- Time-based `revalidate: N` and stale-while-revalidate background regen
- `revalidatePath` / `revalidateTag` / `action({ revalidate })`

**Supported on Workers:**

- Build-time SSG (`router.ssg`) uploaded to **Assets** (or similar)
- **Immutable** prerender (`revalidate: false` or no TTL) served read-only before SSR
- `dynamic: 'force-dynamic'` for fully dynamic routes

Configure `router.adapter: 'cloudflare'` in `vite-plugin-kiru` to emit a worker bundle and warn on incompatible ISR exports.

## Node / Bun quick start

Adapters expose a **Web `fetch` handler** (no Hono required). Vite dev and production both call `default.fetch` on your server entry.

```ts
import { createKiruHandler, serveKiruNode } from "@kirujs/adapter-node"
import { routes } from "./routes"

const isProd = process.env.NODE_ENV === "production"
const kiru = createKiruHandler({
  importMetaUrl: import.meta.url,
  dev: !isProd,
  stream: true,
  routes,
  actions: { secret: process.env.KIRU_ACTIONS_SECRET!, allowedOrigins: ["*"] },
})

export default { fetch: kiru.fetch }

if (isProd) serveKiruNode(kiru)
```

Bun: `createKiruBunServer` from `@kirujs/adapter-bun`, then `export default { fetch: kiru.fetch }` (Bun auto-serves) or `serveKiruBun(kiru)`.

### Optional Hono

```ts
import { createKiruHono } from "@kirujs/adapter-node/hono"

const { app, fetch } = createKiruHono({ /* same options as createKiruHandler */ })
export default app // or { fetch }
```

### Custom middleware

`createKiruHandler` accepts `middleware: KiruMiddleware[]` (outermost first). You can also wrap `kiru.fetch` with `composeFetch` from `@kirujs/adapter-node` for Express, Fastify, etc. — anything that can forward a `Request` and return a `Response`.

## Cloudflare Workers quick start

```ts
import {
  createKiruWorkerHandler,
  assetsBindingToGetAsset,
} from "@kirujs/adapter-cloudflare"
import { routes } from "./routes"
import template from "./dist/client/index.html?raw"

export interface Env {
  ASSETS: { fetch: typeof fetch }
}

const htmlTemplate = template

const handler = createKiruWorkerHandler({
  routes,
  htmlTemplate,
  stream: true,
  getAsset: assetsBindingToGetAsset((req) => env.ASSETS.fetch(req)),
})

export default {
  fetch(request: Request, env: Env) {
    return handler(request, env)
  },
}
```

Set `defineImageConfig({ strategy: "build" })` for edge deploys.

**Wrangler Assets:** enable `run_worker_first = true` so `/` is SSR-rendered instead of serving the raw `index.html` shell. Pass `assetFetch: (req) => env.ASSETS.fetch(req)` into `createKiruWorkerHandler` so `/assets/*` still resolves.

## Capability matrix

See `@kirujs/runtime` — `getRuntimeCapabilities(target)` is the single source of truth used by adapters and the Vite plugin.

## Migration from manual Hono

Replace manual `createRenderer` + static middleware with `createKiruHandler` from `@kirujs/adapter-node`. Use `resolveStatic` from that package only when you need paths without the full handler.

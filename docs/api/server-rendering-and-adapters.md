# Server rendering & adapters

## Overview

Server-side rendering produces HTML documents from HTTP requests. `createRenderer` is the core API; adapters (`@kirujs/adapter-node`, `@kirujs/adapter-bun`, `@kirujs/adapter-cloudflare`) wrap it for production HTTP servers.

The request pipeline: **match route → run middleware → run loaders → render component tree → embed hydration payloads → return HTML or stream**.

---

## How it works

### createRenderer

```ts
const renderer = createRenderer({
  routes,
  htmlTemplate,           // compiled shell with {{kiru_head}} / {{kiru_body}}
  stream: true,           // optional streaming SSR
  prerenderedHtmlDir,     // hybrid ISR disk cache
  actions: { secret, allowedOrigins },
  i18n,
  pathPolicy,
  deployTarget: "node",
  hydrationChunks: true,
})

const result = await renderer.render(request, { context })
// { status, headers, body: string | ReadableStream } | null
```

`null` means no route matched — adapter returns 404 or falls through.

### Embedded payloads

The renderer serializes into HTML:

| Payload | Purpose |
|---------|---------|
| `k-page-data` | Loader JSON for hydration |
| `k-request-context` | Per-request context |
| `k-i18n` | Translation bundle for active locale |
| `k-request-token` | Signed token for remote actions |
| Route chunk manifest | `modulepreload` hints for hydration |

### Streaming

When `stream: true`, the shell (with fallback UI from `serverLoader`) flushes early; loader data and tail content stream afterward. Client `bootstrapSsrClient` replays streamed tail into resources.

### prerenderStaticRoutes

Standalone SSG without Vite:

```ts
const outputs = await prerenderStaticRoutes({
  routes,
  outDir: "./dist",
  site,
  i18n,
  maxConcurrentRenders: 10,
})
```

Returns `StaticRouteOutput[]` with `path`, `html`, `headers`.

### HTML template compilation

```ts
const template = compileRouteHtmlTemplate(htmlSource)
const html = fillRouteHtmlTemplate(template, { headHtml, bodyHtml, title })
```

Tokens: `{{kiru_head}}`, `{{kiru_body}}`, optional `{{kiru_title}}`.

### Node adapter

```ts
import { createKiruHandler, createKiruResponder } from "@kirujs/adapter-node"
```

`createKiruHandler` — full production setup:

- Creates renderer
- Serves static assets from `clientDir`
- Reads ISR cache from `prerenderedHtmlDir`
- Calls `getRequestContext` per request

`createKiruResponder` — lower-level; returns `KiruResponder` with `.handle(request)`.

### Middleware composition

```ts
import { composeRespond, toFetchHandler } from "@kirujs/adapter-node"

const app = composeRespond([
  corsMiddleware,
  kiruResponder.respond,
])
```

### Bridge utilities

| Export | Purpose |
|--------|---------|
| `toNodeListener` | Node `http.createServer` listener |
| `nodeRequestToFetch` | Convert Node req/res to `Request` |
| `writeNodeResponse` | Write `Response` to Node res |
| `serveStaticFile` | Static file from disk |
| `resolveStatic` | Resolve SSR asset paths |

### Cloudflare / Bun

- `@kirujs/adapter-cloudflare` — Workers `fetch` handler
- `@kirujs/adapter-bun` — Bun.serve integration

Both accept the same `createRenderer` options with `deployTarget` set accordingly.

### Wiring remotes and loaders

Server entry must import virtual registries:

```ts
import "virtual:kiru:remote-registry"
import "virtual:kiru:loader-registry"
```

Pass `actions: { secret, allowedOrigins }` to `createRenderer` / `createKiruHandler` for remote HTTP dispatch.

---

## API reference

### Renderer

```ts
import {
  createRenderer,
  type CreateRendererOptions,
  type Renderer,
  type StreamRenderer,
  prerenderStaticRoutes,
  fillRouteHtmlTemplate,
  compileRouteHtmlTemplate,
  serializeKiruRequestTokenScript,
  serializeKiruRequestTokenScriptAsync,
} from "kiru/router"
```

```ts
type CreateRendererOptions = {
  routes: RouteTreeDefinition | RouteManifest
  htmlTemplate?: string
  prerenderedHtmlDir?: string
  stream?: boolean
  pathPolicy?: RouterPathPolicy
  i18n?: InternationalizationConfig
  actions?: { secret: string; allowedOrigins?: string[] }
  getRequestContext?: GetRequestContext
  // …prerender cache, deploy target, request limits
}

interface Renderer {
  manifest: RouteManifest
  render(
    requestOrUrl: Request | string,
    context?: RenderRequestContext
  ): Promise<RenderResult | null>
}

interface StreamRenderer {
  manifest: RouteManifest
  render(
    requestOrUrl: Request | string,
    context?: RenderRequestContext
  ): Promise<StreamRenderResult | null>
}

type RenderResult = { status: number; headers: Record<string, string>; body: string }
type StreamRenderResult = { status: number; headers: Record<string, string>; body: ReadableStream<string> }
```

`RouteTreeDefinition`, `RouteManifest`, and `RouterPathPolicy` are in [routes-and-scopes.md](./routes-and-scopes.md). `InternationalizationConfig` is in [i18n.md](./i18n.md).

### Node adapter

```ts
import {
  createKiruHandler,
  createKiruResponder,
  toNodeListener,
  composeRespond,
  serveStaticFile,
  resolveStatic,
  toFetchHandler,
  asKiruHandle,
  diskPrerenderCache,
  type CreateKiruHandlerOptions,
  type GetRequestContext,
  type KiruMiddleware,
} from "@kirujs/adapter-node"
```

```ts
type CreateKiruHandlerOptions = {
  routes
  importMetaUrl: string
  dev?: boolean
  clientDir?: string
  prerenderedHtmlDir?: string | false
  serveStaticAssets?: boolean
  getRequestContext?: GetRequestContext
  deployTarget?: "node" | "bun"
  i18n?: InternationalizationConfig
  actions?: { secret: string; allowedOrigins: string[] }
  stream?: boolean
  // …CreateRendererOptions fields
}
```

`GetRequestContext` is defined in [request-context.md](./request-context.md).

---

## Examples

### Basic — minimal Node server

```ts
// server.ts
import { createKiruHandler } from "@kirujs/adapter-node"
import { routes } from "./routes"

const handler = createKiruHandler({
  routes,
  importMetaUrl: import.meta.url,
})

export default { fetch: handler }
```

```json
// package.json
{ "scripts": { "start": "node dist/server.js" } }
```

### Intermediate — request context on server

```ts
import { createKiruHandler } from "@kirujs/adapter-node"

export default createKiruHandler({
  routes,
  importMetaUrl: import.meta.url,
  async getRequestContext(request) {
    const session = parseCookie(request.headers.get("cookie"))
    return {
      user: session ? await loadUser(session.id) : null,
    }
  },
})
```

### Intermediate — streaming SSR

```ts
import { createRenderer } from "kiru/router"

const renderer = createRenderer({
  routes,
  htmlTemplate: compiledTemplate,
  stream: true,
  actions: {
    secret: process.env.REMOTE_SECRET!,
    allowedOrigins: ["https://myapp.com"],
  },
})

export default {
  async fetch(request: Request) {
    const result = await renderer.render(request, {
      context: await buildContext(request),
    })
    if (!result) return new Response("Not Found", { status: 404 })
    return new Response(result.body, {
      status: result.status,
      headers: result.headers,
    })
  },
}
```

### Advanced — hybrid ISR handler

```ts
import { createKiruHandler } from "@kirujs/adapter-node"
import "virtual:kiru:remote-registry"

export default createKiruHandler({
  routes,
  importMetaUrl: import.meta.url,
  prerenderedHtmlDir: "./dist/client",
  serveStaticAssets: true,
  getRequestContext,
  i18n,
  actions: {
    secret: process.env.REMOTE_SECRET!,
    allowedOrigins: [process.env.APP_URL!],
  },
})
```

Serves prerendered HTML from disk when fresh; SSR regenerates stale ISR routes.

### Advanced — custom middleware stack

```ts
import { createKiruResponder, composeRespond } from "@kirujs/adapter-node"
import { createRenderer } from "kiru/router"

const renderer = createRenderer({ routes, htmlTemplate })
const kiru = createKiruResponder({
  renderer,
  importMetaUrl: import.meta.url,
  getRequestContext,
})

const respond = composeRespond([
  async (req, next) => {
    const res = await next(req)
    res.headers.set("X-Powered-By", "Kiru")
    return res
  },
  kiru.respond,
])

export default { fetch: (req) => respond(req) }
```

### Advanced — standalone SSG build

```ts
import { prerenderStaticRoutes, defineSiteConfig } from "kiru/router"
import { routes } from "./routes"

const site = defineSiteConfig({ url: "https://example.com" })

await prerenderStaticRoutes({
  routes,
  outDir: "./dist/static",
  site,
  i18n,
})
```

Use without Vite when generating static sites from a Node script or CI job.

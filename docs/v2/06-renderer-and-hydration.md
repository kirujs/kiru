# Renderer, HTML shell, and hydration

Server rendering centers on `createRenderer` (`packages/lib/src/router/renderer.ts`), which orchestrates smaller modules. Client continuation uses `bootstrapSsrClient` / `bootstrapSsgClient` (`packages/lib/src/ssr/routerHydrate.ts`).

## `createRenderer`

```ts
import { createRenderer } from "kiru/router"

const renderer = createRenderer({
  routes,
  htmlTemplate,           // filled shell string with {{kiru_head}} {{kiru_body}}
  prerenderedHtmlDir,     // hybrid: path to dist/client
  prerenderCache,         // optional custom PrerenderCacheStore
  stream: true,            // streaming renderer variant
  pathPolicy: { baseUrl: "/app", trailingSlash: "never" },
  i18n,
  deployTarget: "node",    // node | bun | cloudflare
  actions: { secret, allowedOrigins },
  routeMiddleware: [...],
})
```

### `render(request, { context })`

Returns `null` when no route matches (adapter returns 404 or fallthrough).

Returns `{ status, headers, body: string | ReadableStream }` on hit.

Internal steps (simplified):

1. Locale detection redirect (i18n)
2. **Prerender disk short-circuit** (production, non-edge) — `prerenderServe.ts`
3. `prepareAppForUrl` (`prepareAppForUrl.ts`) — match, middleware, loaders, head
4. Render JSX → HTML string (`ssrAppBuild.ts` / `staticRouteRender.ts`) or stream (`rendererStream.ts`)
5. Inject scripts (`k-page-data`, `k-request-context`, `k-i18n`, action token)
6. Remote `POST /?action=` handling on same renderer when configured
7. Render errors → `renderErrorRecovery.ts`; ISR regen → `prerenderRegenerate.ts`

### Streaming

`stream: true` returns `StreamRenderer` with deferred loader placeholders (`kiru:deferred`). Use `serverLoader({ fallback })` + static page head for PPR-lite.

**Docs caveat:** `RouterView` alone is insufficient for stream hydration — use `createRouterApp` from `kiru/router/ssr`.

## HTML template

Default Vite `index.html`:

```html
<head>{{kiru_head}}</head>
<body>
  <div id="app">{{kiru_body}}</div>
</body>
```

`fillRouteHtmlTemplate` merges route head + asset preload links from Vite manifest.

Plugin option `router.htmlShell` can override per-route document assembly.

## Hydration bootstrap

### SSR — dynamic hydration

```ts
// kiru/router/ssr → bootstrapSsrClient
hydrateOptions: { hydrationMode: "dynamic" }
```

Matches live DOM from server render; subscribes to `router.match`, `loaderEpoch`, context gate for outlet updates.

### SSG — static hydration

```ts
// kiru/router/ssg → bootstrapSsgClient
hydrateOptions: { hydrationMode: "static" }
```

Assumes DOM matches prerender snapshot; still enables client routing after attach.

### Shared hydrate flow

1. `createRouter({ routes, ... })` with current URL
2. `registerKiruRouter(router)`
3. `ensureClientI18nReady`
4. Stash `location.hash` (fragments not in SSR HTML)
5. Build outlet from committed match + `useHydratedPageData: true`
6. `hydrate(createSsrRouterShell(...), container)`
7. Subscribe navigations with `useHydratedPageData: false`
8. Register `__kiru_loaders` + `__kiru_serverActions` dispatchers (SSR)
9. Set `window.__kiruHydratedAt` (E2E timing)

### `createSsrRouterShell`

Wraps outlet in `RequestContextProvider` + optional `I18nReactiveRoot` — targeted updates without full page remount when loader cache refetches.

## Client-only CSR mount

```ts
// kiru/router/csr
mount(RouterProvider + RouterView, container)
```

No hydrate; no serialized scripts required.

## Hash / search fix (branch)

SSR HTML is generated with `hash: ""` to avoid text-node mismatch. `stashClientHashForSsrHydration` clears router hash until after hydrate, then restores (`routerHydrate.ts`).

Search params and hash resolution fixes landed in commits `eb069f6b` (see unit tests around `requestUrl.ts`).

## Remote dispatch endpoints

Registered on SSR hydrate:

| Global | Endpoint |
|--------|----------|
| `__kiru_loaders.dispatch` | `POST /?loader=<routeId>:load` |
| `__kiru_serverActions.dispatch` | `GET/POST /?action=<id>` |

Both send `x-kiru-token` from serialized request context.

## `getRequestContext` adapter hook

```ts
createKiruResponder({
  getRequestContext: async (request) => ({
    user: await sessionFromCookie(request),
  }),
})
```

Passed into `renderer.render(request, { context })` — flows to middleware, loaders, `k-request-context`, and action tokens. Loaders receive `context` via `LoaderContext`; sync SSR render also sets `runWithSsrRequestContext` for `useRequestContext()` / in-render `action()` (see [09-actions-and-remote.md](./09-actions-and-remote.md)).

**Production server entry:** `import "virtual:kiru:remote-registry"` alongside `createKiruResponder` so action handlers are registered in the SSR bundle.

**Aborted SSR:** When `request.signal` aborts or loader work is discarded mid-prepare, `render()` returns `null` (adapter typically maps to no body / connection end), not a 500. Node: `nodeRequestToFetch` + `bindClientDisconnectAbort` wire client disconnect to the same signal ([deploy-runtimes.md](../router/deploy-runtimes.md)).

## Error pages

Uncaught render errors bubble to nearest `error` module on scope/page (`prepareAppForUrl` try/catch path). Leaf errors override scope (`sandbox/ssr` `/break-ssr-leaf`).

## Use-case: minimal SSR server

```ts
// server/index.ts
import { createKiruResponder } from "@kirujs/adapter-node"
import { routes } from "./routes"

export default {
  fetch: createKiruResponder({
    importMetaUrl: import.meta.url,
    routes,
    stream: false,
  }).fetch,
}
```

```ts
// main.tsx
import { createRouterApp } from "kiru/router/ssr"

void createRouterApp({
  routes,
  container: document.getElementById("app")!,
})
```

## Use-case: SSG + hydrate (no server)

```ts
// main.tsx
import { createRouterApp } from "kiru/router/ssg"

void createRouterApp({ routes, container: document.getElementById("app")! })
```

Build: `vite build` with `router.ssg: true` → deploy `dist/` to static host.

## Devtools / `transformIndexHtml`

| Mode | Devtools injection |
|------|-------------------|
| CSR / SSG dev | Vite `transformIndexHtml` |
| SSR dev | Plugin injects into SSR response (template read from disk bypasses Vite HTML pipeline) |

Other Vite HTML plugins may not run on SSR documents unless you transform `htmlTemplate` before `createRenderer`.

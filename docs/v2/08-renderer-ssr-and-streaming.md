# Renderer, SSR, and streaming

`createRenderer` is the server entry point for HTML generation, action/loader multiplexing, and optional streaming. It wraps `prepareAppForUrl` and HTML assembly.

Source: `packages/lib/src/router/renderer.ts`, `rendererStream.ts`, `ssrAppBuild.ts`, `prepareAppForUrl.ts`.

---

## Factory overloads

```typescript
createRenderer({ routes, stream: false, ... })  // → Renderer
createRenderer({ routes, stream: true, ... })   // → StreamRenderer
```

Both share `prepareRenderer` setup:

- Compiled manifest
- HTML template validation
- Optional `createRemoteHandler` + `createLoaderHandler`
- Prerender path set + cache (non-edge)

---

## `render(request | url, context?)`

Returns `null` when no route (adapter handles 404).

Otherwise:

| Mode | Body type | Headers |
|------|-----------|---------|
| Buffered | `string` | `content-type: text/html; charset=utf-8` + route cache headers |
| Stream | `ReadableStream<string>` | Same |

### Production static short-circuit

When `prerenderedHtmlDir` set and `NODE_ENV === "production"`:

1. Resolve pathname against `generatePublicStaticPaths` set
2. `tryServePrerenderedFromDisk` / cache store
3. On hit → return HTML without running React pipeline
4. On miss → full SSR (or ISR regen — [10-isr-hybrid-and-prerender.md](./10-isr-hybrid-and-prerender.md))

**Development:** Always SSR — ensures HMR and loader changes visible.

---

## `prepareAppForUrl` pipeline

High-level steps:

1. Parse URL (`parseRequestUrl`), apply `pathPolicy`
2. i18n locale split / detection redirects
3. `matchRoute`
4. **Middleware chain** → redirect | error | abort
5. Search/param validation
6. Load page module (`resolveSsrRouteModule`)
7. `runPageLoad` — may set `pagePropsPromise` for streaming
8. Build `app` JSX (`buildAppElement`)
9. Attach response status/headers from route exports (`routeResponse.ts`, `routeRevalidate.ts`)

Outputs `PreparedApp`:

| Field | Purpose |
|-------|---------|
| `app` | JSX tree |
| `serializedPageData` | For `k-page-data` |
| `streamHeadMeta` | Early head flush |
| `pagePropsPromise` | Deferred loader for stream |
| `earlyFlushHead` | Template supports head-before-body |
| `i18nPayload` | Translation hydration |

---

## Streaming

`renderStreamForRouteMatch` uses `renderToReadableStream` (`ssr/server.ts`).

### Early head flush

When:

- `earlyFlushHead` true, and
- Compiled template has `headBeforeBody`

`onStreamStart` enqueues `<head>…</head>` before body shell completes — improves LCP for slow loaders.

### Shell ready

`onShellReady` completes document wrapper, injects page data when loader promise resolves.

Tests: `ssr-streaming.test.tsx`, streaming cases in `router.test.tsx` (when run).

---

## Buffered (non-stream) rendering

`renderStringWithDocument` / `renderSsrErrorRecovery` — full string for simpler adapters or error paths.

**Trade-off:** TTFB higher; debugging easier.

---

## Error recovery

`renderErrorRecovery.ts` + `loadErrorRouteTree` / `loadRootErrorRouteTree`:

- Page throw → nearest route `error` component
- Custom error loader throw → fallback generic 500 with original message in `<pre>`
- notFound throw with root error → 500 page with error UI

Documented in tests (router.test.tsx error cases).

---

## Route response exports

Page modules may export:

| Export | Effect |
|--------|--------|
| `headers` | Extra response headers |
| `status` | HTTP status override |
| `cache` | Cache-Control via `cachePolicyToHeaders` |
| `isr` | ISR config (`defineISR`) |

Read via `readRouteHeadersExport`, `readRouteStatusExport`, `readRouteCacheExport`, `readRouteISRExport`.

---

## Remote multiplex on same handler

Renderer engine checks action/loader query before page render:

- Action → JSON or redirect response
- Loader → JSON loader data
- Else → HTML render path

Adapters should forward **all** app routes to `KiruHandle` or place Kiru behind a catch-all.

---

## `fillRouteHtmlTemplate`

Utility for adapters manually stitching:

```typescript
fillRouteHtmlTemplate(templateHtml, {
  body: innerHtml,
  headHtml: document.headHtml,
  title: document.title,
})
```

---

## Prerender-only helpers

| Function | Use |
|----------|-----|
| `renderMatchToStaticHtml` | SSG build render single path |
| `stripPrerenderedRequestInjections` | Remove context/token scripts for static public pages |
| `hydratePrerenderedHtmlForRequest` | Test/helper hydration |

---

## Performance notes

- `generatePublicStaticPaths` cached per renderer instance
- Prerender cache async init on first ISR use
- **Route module preloads** — `createRenderer` appends `<link rel="modulepreload">` to document head from `kiru-route-chunks.json` (or `hydrationChunks` option). Streaming uses the same links in early head flush; do not add extra `<script type="module">` tags. See [22-hydration-module-prewarm-adr.md](./22-hydration-module-prewarm-adr.md).

---


## Further reading

- [09-client-bootstrap-and-hydration.md](./09-client-bootstrap-and-hydration.md)
- [10-isr-hybrid-and-prerender.md](./10-isr-hybrid-and-prerender.md)
- [14-adapters-and-deploy-runtimes.md](./14-adapters-and-deploy-runtimes.md)

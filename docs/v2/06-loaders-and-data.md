# Loaders and page data

Loaders are the **primary data layer** for route modules. They feed `PageProps` on the server, serialize into the HTML for hydration, and re-run on client navigations according to their kind and cache options.

---

## Loader kinds

Defined in `packages/lib/src/router/loaders.ts`:

| Kind | Factory | Server first paint | SSG build | Client nav |
|------|---------|-------------------|-----------|------------|
| **server** | `serverLoader({ load, fallback })` | In-process | No | `POST /?loader=` |
| **static** | `staticLoader(fn)` | N/A | Inlined in bundle/HTML | Read payload |
| **universal** | `loader()` / universal | In-process | Can prerender | Re-runs on client |
| **client** | `clientLoader()` | Skipped / empty | Skipped | Client only |

All expose `__kiruLoader` discriminator and `__kiruInvoke(ctx)`.

### `serverLoader`

- **Requires** SSR (or hybrid) server with loader handler registered.
- **Requires** client bundle `__KIRU_SSR__` for navigations after hydration.
- `fallback` component renders while load in flight (and streaming gate — see `pageLoadGate.tsx`).

Dev warnings (`devWarnings.dev.ts`):

- Pure CSR/SSG client calling server loader.
- SSR bundle without `__kiru_loaders` dispatch wired.

### `staticLoader`

- Data frozen at prerender; injected as `__kiruStaticLoaderPayload` in client chunks (vite plugin).
- `readPageStaticLoaderPayload` / `pageModuleUsesStaticLoader` on client.
- Best for marketing pages with zero server after deploy.

### `universal` / default `loader`

- Runs on server when rendering; on client navigations invokes client path unless cache says otherwise.

### `clientLoader`

- Never runs on server; useful for browser-only APIs.

---

## Loader context

```typescript
interface LoaderContext {
  params: Record<string, string>
  url: { pathname, search, hash }
  query: RouterQuery
  context: CustomRequestContext
  meta: RouteMeta
  route: { id: string }
  request?: Request      // server only
  signal: AbortSignal    // navigation cancel
  locale?: string        // when i18n enabled
}
```

Built by `buildLoaderContext` / `buildLoaderContextForMatch` (`runPageLoad.ts`).

Validated params/query come from `validateSearchForMatch` when page exports `validation`.

---

## Validation

`LoaderValidationConfig` + Standard Schema support (`loaderValidation.ts`):

```typescript
export const validation = {
  params: z.object({ id: z.string() }),
  query: z.object({ page: z.coerce.number().optional() }),
}
```

Invalid search → redirect or cancel navigation (CSR) / prepare failure (SSR).

---

## Execution pipeline

### SSR

`prepareAppForUrl` → `prepareRouteForNavigation` (server variant) → `runPageLoad` → page props including `data`, `error`, loader state.

Serialized subset in `<script type="application/json" k-page-data>` via `serializePageDataScript`.

### Client (RouterView or SSR outlet)

`prepareRouteForNavigation` → `runPageLoad` with:

- `useHydratedPageData: true` on first hydrate pass (read script once)
- `forceReload` when `router.invalidate()` bumped `loaderEpoch`

`readHydratedPageData` / `resetHydratedPageData` manage one-time hydration consumption.

---

## Loader RPC (client)

`packages/lib/src/router/loaderClient.ts`:

```typescript
fetch(`/?loader=${encodeURIComponent(`${routeId}:load`)}`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-kiru-token": requestToken.current,
  },
  body: JSON.stringify(context),
  signal: context.signal,
})
```

Handler: `createLoaderHandler` in `loaderRegistry.ts` — verifies token, dispatches to registry populated by vite codegen (`virtual:kiru:loader-registry`).

**Security:** Treat as same-origin authenticated API — use `actions.secret`, rotate tokens, restrict origins on renderer.

---

## Client cache

`loaderCache.ts`:

| Option | Default | Meaning |
|--------|---------|---------|
| `staleTime` | 0 | Ms until background revalidate |
| `gcTime` | 300_000 | Ms to keep unused entries |

`router.invalidate({ routeIds })` — bust cache, bump `loaderEpoch`, clear hydrated page data.

Action responses may send `x-kiru-invalidate` — `applyActionResponseHeaders` in `routerGlobal.ts`.

`scheduleStaleLoaderRevalidate` — stale-while-revalidate style behavior for navigations.

---

## Prefetch

`prefetchRoute` + `Link` `prefetch` prop on pointerenter (default when loader RPC is available: `chunks: true`, `data: true`):

| Flag | Behavior |
|------|----------|
| `data` | `POST ?loader=` for server/universal loaders (e2e: “prefetches server loader data on link hover”) |
| `chunks` | Injects `<link rel="modulepreload">` for the target route from `kiru-route-chunks.json` — does **not** call speculative `import()` |

See [22-hydration-module-prewarm-adr.md](./22-hydration-module-prewarm-adr.md).

---

## Navigation scope & abort

`navigationScope.ts`:

- Each navigation gets `AbortSignal`
- `createNavigationScope` + `isScopeCurrent` prevent stale loader results committing after fast navigations
- SSR request uses `loaderSignalFromRequest(request)` tied to request abort

Tests: `navigationAbort.test.ts`, `ssrAbort.test.ts`, `ssgAbort.test.ts`.

---

## Page props shape

`PageProps<Loader>` — default export receives loader data type-inferred from `load` export.

Async page head can read loader output via `defineHeadContent` / `head` export (`pageHead.ts`).

---

## Choosing a loader strategy

| Scenario | Loader |
|----------|--------|
| DB fetch on every personalized view | `serverLoader` |
| Blog post body at build time | `staticLoader` |
| Same code server + client, accept double run | `universal` / `loader` |
| `localStorage` / geolocation | `clientLoader` |
| Hybrid marketing + app | Static for `/`, server for `/app/*` |

---

## Further reading

- [03-rendering-modes.md](./03-rendering-modes.md)
- [07-remote-actions.md](./07-remote-actions.md)
- [08-renderer-ssr-and-streaming.md](./08-renderer-ssr-and-streaming.md)
- [15-testing.md](./15-testing.md)

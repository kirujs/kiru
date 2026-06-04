# Client bootstrap and hydration

After the server (or build) produces HTML, the client must **hydrate** a compatible tree, restore serialized state, and resume navigations. Kiru splits bootstrap APIs by mode to keep bundles lean.

---

## Recommended entry points

| Mode | Import | Function |
|------|--------|----------|
| CSR | `kiru/router/csr` | `createRouterApp` |
| SSR | `kiru/router/ssr` | `createRouterApp` |
| SSG | `kiru/router/ssg` | `createRouterApp` |
| Advanced | `kiru/ssr/router` | `bootstrapSsrClient` / `bootstrapSsgClient` |

All return `AppHandle` (`dispose`, etc.) from `appHandle.ts`.

---

## CSR bootstrap

`packages/lib/src/router/bootstrap/csr.ts`:

1. `createRouter({ routes, pathPolicy, transition, i18n })`
2. `ensureClientI18nReady(router)`
3. Mount `RouterProvider` + `RouterView`
4. Optional `I18nReactiveRoot` wrapper

Uses full `window.history` navigation (`navigation.ts`).

**Does not** call `ensureLoaderClient` for server loaders unless you hybrid-wire a server (unsupported pattern for pure CSR).

---

## SSR bootstrap (`bootstrapSsrClient`)

`packages/lib/src/ssr/routerHydrate.ts`:

### Steps

1. `compileRouteTree` if needed
2. `createRouter({ routes: manifest, i18n })` — **full** navigable router, not `createStaticRouter`
3. `RouterProvider` claims the active router (`claimActiveRouter`) for action invalidation and RPC base URL
4. `ensureLoaderClient()` + `ensureServerActionsClient()` — wire `window.__kiru.router.loaders` / `window.__kiru.router.serverActions`
5. `ensureClientI18nReady(router)`
6. **Hash stash** — `stashClientHashForSsrHydration` clears router hash during hydrate (fragments not sent on HTTP)
7. Pre-build outlet: `buildSsrClientOutlet` with `useHydratedPageData: true`
8. `hydrate(Fragment + createSsrRouterShell(() => outlet.value), container, { hydrationMode: "dynamic" })`
9. `subscribeSsrClientOutlet` — on `match` / `isNavigating` / `currentNavigation` refresh outlet with `useHydratedPageData: false`
10. Restore hash after hydrate
11. (Apps only) mark hydration on `#app` with `data-kiru-hydrated-at` after bootstrap resolves — not a framework contract

### Shell

`createSsrRouterShell` (`routerShell.tsx`) — `RequestContextProvider`, `Link` context, i18n runtime, **no `RouterView`**.

### Why not `RouterView` on SSR?

`RouterView` uses `resource()` tied to router signals but does not implement the initial **preloaded** subtree match the server rendered. Dev warning `warnRouterViewWithoutSsrBootstrap` if `RouterView` mounts in SSR bundle without bootstrap.

---

## SSG bootstrap (`bootstrapSsgClient`)

Thin wrapper:

```typescript
bootstrapSsrClient({
  ...options,
  hydrateOptions: { ...options.hydrateOptions, hydrationMode: "static" },
})
```

**Static hydration** tells Kiru reconciler the DOM is static-first; navigations after still use full client router.

SSG and SSR share **outlet subscription** architecture — same parity considerations.

---

## Dual outlet architecture (critical)

| Path | Outlet mechanism | Pending UX |
|------|------------------|------------|
| CSR | `RouterView` → `resource()` | `isLoaderPending`, `ErrorBoundary` |
| SSR/SSG | `signal` + `subscribeSsrClientOutlet` | `isLoaderPending`, `isNavigating`, manual refresh |

Both call `buildClientOutletSubtree` → `prepareRouteWithDocumentHead` → `prepareRouteForNavigation`.

Shared navigation-end logic: `canEndClientNavigation` / `tryClearClientNavigation` in `packages/lib/src/router/outletNavigation.ts` (used by `RouterView` and `subscribeSsrClientOutlet`).

### Decision: keep dual outlets (Sprint 2, 2026-05-22)

**Unification deferred.** CSR `RouterView` and SSR/SSG `subscribeSsrClientOutlet` stay separate because:

- CSR needs `resource()` + `ErrorBoundary` for async outlet work and render throws.
- SSR/SSG need a pre-hydrate outlet build, per-refresh `AbortController`, and `useHydratedPageData: true` only on first paint.

Tree building is already shared (`clientRoutePrep.ts`). Scheduling and error recovery stay in two modules until a later spike proves a single outlet can cover both without regressing hydration.

| Concern | CSR | SSR/SSG |
|---------|-----|---------|
| Scheduling | `resource()` deps | `match` / `isNavigating` / `outletRenderError` subscriptions |
| `useHydratedPageData` | always `true` in outlet | `true` first paint, `false` after hydrate |
| Invalidate | `loaderEpoch` in `resource()` deps | `loaderEpoch.subscribe` → `refreshOutletOnInvalidate` |
| Render throw | `ErrorBoundary` → `outletRenderError` | `onLeafRenderError` + `outletRenderError` subscription |

### Parity checklist (e2e / integration)

Behaviors both paths must match after hydrate. Checked in Cypress or lib tests.

| Scenario | CSR | SSR hydrate | SSG hydrate |
|----------|-----|-------------|-------------|
| Client nav → `serverLoader` refetch | loaders e2e | ssr e2e | static loader nav |
| `router.invalidate()` refetch | router.test | ssr invalidate-demo | ssg-parity (clientLoader + invalidate trigger) |
| Action `x-kiru-invalidate` | — | ssr invalidate-demo | — (SSG preview has no action RPC) |
| Back/forward + loader cache | navigation e2e | ssr e2e | ssg history e2e |
| Link prefetch hover (loader RPC + chunk `modulepreload`) | parity.cy.ts | ssr.cy.ts | — |
| Render error → error route | error-recovery e2e | ssr-break e2e | 404 static |
| Middleware redirect | guarded e2e | guarded e2e | — |
| Middleware `{ error }` | parity.cy.ts | HTTP 403 + lib jsdom | ssg parity e2e |
| Hash-only change | parity.cy.ts | url-state e2e | ssg hash e2e |
| Locale prefix nav | i18n e2e | tier3 / i18n | i18n e2e |

**Risk:** Bug fixes must often be applied in **two** scheduling layers — see [16-gaps-risks-and-launch-checklist.md](./16-gaps-risks-and-launch-checklist.md).

---

## Module pre-warm (v2)

Kiru avoids cold `import()` waterfalls during hydration and navigations by emitting **route-scoped** [`<link rel="modulepreload">`](https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/rel/modulepreload) hints.

| Surface | Mechanism |
|---------|-----------|
| SSR/SSG first paint | Bootstrap shared chunks (`fetchpriority="low"`) + route `modulepreload` in `{{kiru_head}}` from `kiru-route-chunks.json` |
| Client bootstrap | `loadClientHydrationChunksManifest()` fetches `/kiru-route-chunks.json` |
| `Link` hover (`prefetch.chunks`) | `preloadChunksForMatch` injects target-route links — **no** speculative `import()` in `prefetchRoute` |
| Navigate / hydrate | `loadRouteTree` still runs `component()` / `layout?.()`; preloads only warm the graph |

Loader **data** prefetch (`prefetch.data`, `POST ?loader=`) is unchanged. See [06-loaders-and-data.md](./06-loaders-and-data.md) and [22-hydration-module-prewarm-adr.md](./22-hydration-module-prewarm-adr.md).

---

## Hydrated payloads

Scripts parsed on startup:

| Script `type` | Reader |
|---------------|--------|
| `application/json` + `k-page-data` | `readHydratedPageData` |
| `k-request-context` | `readHydratedRequestContext` |
| `k-request-token` | `requestToken` global |
| `k-i18n` | `readHydratedI18n` |

`resetHydratedPageData` on `router.invalidate()`.

---

## Invalidation refresh

On `router.invalidate()`:

- Abort in-flight outlet via `invalidateAbort` controller
- `refreshOutlet(true)` with `forceReload`
- Clears streamed SSR client state (`clearStreamedSsrClientState`)

Action headers can trigger same via `applyActionResponseHeaders`.

---

## i18n client

`ensureClientI18nReady` loads messages for initial locale; `I18nReactiveRoot` wraps outlet when configured.

Locale change on navigate updates runtime + async `loadI18nMessages`.

---

## Scroll restoration

CSR router sets `history.scrollRestoration = "manual"` and maintains `scrollStack` indexed by history state — back/forward restores position (`csr.ts` popstate handler).

---

## Testing hooks

- `#app[data-kiru-hydrated-at]` — e2e apps set once when bootstrap resolves; Cypress waits before clicking `Link`
- `window.__kiru.router.loaders` / `window.__kiru.router.serverActions` — client RPC dispatch (also via `__kiruEnsureLoaderDispatch` / `__kiruEnsureRemoteDispatch`)
- `window.__kiru.lazy.cache` — lazy import cache

---

## Common mistakes

| Mistake | Symptom |
|---------|---------|
| Hydrate CSR bundle on SSR HTML | Mismatch, duplicate requests |
| Skip `ensureLoaderClient` on custom bootstrap | Server loader never refetches |
| Import `kiru/router/ssg` client with SSR server | RPC/actions fail |
| `#hash` only change on SSR | Handled via hash stash — do not remove |

---

## Further reading

- [03-rendering-modes.md](./03-rendering-modes.md)
- [06-loaders-and-data.md](./06-loaders-and-data.md)
- [01-architecture.md](./01-architecture.md)

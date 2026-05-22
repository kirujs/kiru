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
3. `registerKiruRouter(router)` — global for actions invalidation
4. `ensureLoaderClient()` + `ensureServerActionsClient()` (remote dispatch)
5. `ensureClientI18nReady(router)`
6. **Hash stash** — `stashClientHashForSsrHydration` clears router hash during hydrate (fragments not sent on HTTP)
7. Pre-build outlet: `buildSsrClientOutlet` with `useHydratedPageData: true`
8. `hydrate(Fragment + createSsrRouterShell(() => outlet.value), container, { hydrationMode: "dynamic" })`
9. `subscribeSsrClientOutlet` — on `match` / `isNavigating` / `currentNavigation` refresh outlet with `useHydratedPageData: false`
10. Restore hash after hydrate
11. Set `window.__kiruHydratedAt` for e2e timing

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
| SSR/SSG | `signal` + `subscribeSsrClientOutlet` | `isNavigating`, manual refresh |

Both call `buildClientOutletSubtree` → `prepareRouteWithDocumentHead` → `prepareRouteForNavigation`.

**Risk:** Bug fixes must often be applied in **two** places or unified — see [16-gaps-risks-and-launch-checklist.md](./16-gaps-risks-and-launch-checklist.md).

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

- `window.__kiruHydratedAt` — Cypress waits for hydration before clicking `Link`
- `__kiruEnsureRemoteDispatch` / `__kiruEnsureLoaderDispatch` — test and codegen hooks

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

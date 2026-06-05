# v2 breaking changes (vs `main`)

Inventory for **S0-4** and the Sprint 5 **MIGRATION.md**. Package version on branch is still `1.5.3` until **P1-7** bumps to `2.0.0`.

**Verified:** 2026-05-22 — `node builderman.js test` green; lib `pnpm test` (407 tests); remote-actions e2e in `e2e/ssr`; dev warning guards in lib CI.

---

## Router bootstrap (required)

| Before (v1-style) | After (v2) |
|-------------------|------------|
| Single client mount path | `createRouterApp` from **`kiru/router/csr`** (SPA) |
| SSR HTML + generic router import | **`kiru/router/ssr`** |
| SSG / static HTML hydrate | **`kiru/router/ssg`** |

Wrong bootstrap triggers **dev warnings** (`devWarnings.guard-*.test.ts`). SSR/SSG HTML mounted with `csr` loses loader data and request context.

See [17-package-exports-and-import-guide.md](./17-package-exports-and-import-guide.md), [09-client-bootstrap-and-hydration.md](./09-client-bootstrap-and-hydration.md).

---

## Remote functions

| Before | After |
|--------|--------|
| `action()` factory (JSON + form in one API) | **`query()`**, **`mutation()`**, **`form()`** — see [23-remote-functions.md](./23-remote-functions.md) |
| `*.actions.ts` modules | **`*.remote.ts`** (`router.remote` glob) |
| `action({ validation: { body: schema } })` | **`mutation(schema, handler)`** or **`form(schema, handler)`** |
| `action({ type: "form", handler })` | **`form(handler)`** or **`form(schema, handler)`** |
| `query({ middleware, handler })` / `mutation({ schema, handler })` config objects | **`query(handler)`** / **`query(schema, handler)`** — auth via **`getRequestEvent()`** in handler |
| `form({ refreshable, revalidate, handler })` | **`form(handler)`** / **`form(schema, handler)`** — use **`requested()`**, **`revalidatePath`**, **`revalidateTag`** in handler |
| Read-like `action(async ({ context }) => …)` | **`query(async () => { const { context } = getRequestEvent(); … })`** |
| JSON writes `action(async ({ request }) => …)` | **`mutation(schema, handler)`** or void **`mutation(async () => …)`** with **`getRequestEvent()`** |
| Handler args `{ context, response, signal, redirect }` | **`getRequestEvent()`** — handlers receive validated input only (when `schema` exists) |
| `buildActionRpcUrl`, `createRemoteActionHandler` | **Removed** — use `buildMutationRpcUrl`, `createRemoteHandler` |
| `RemoteFormActionHandlerArgs`, `RemoteFormActionFunction` | **Removed** — use `getRequestEvent()` + `RemoteFormHandler` types |
| `ActionExecution`, `ActionCookies`, `ActionMiddleware`, `ActionDispatchError` | **`RemoteExecution`**, **`RemoteCookies`**, **`RemoteDispatchError`** — **`RemoteMiddleware`** removed; use **`getRequestEvent()`** guards |
| `FormActionClientOutput` | **`RemoteFormClientOutput`** |
| `toggleTodo({ body: { id } })` call style | **`toggleTodo({ id })`** — input is positional, not wrapped in `{ body }` |
| Legacy `action()` HTTP dispatch in `remoteHttpHandler` | **Removed** — registry entries must be `RemoteQuery`, `RemoteMutation`, or `RemoteFormMutation` |
| `action.get` / `action.post` / verb helpers | **Removed** — queries use `?query=`, mutations use `?mutation=` (POST + JSON) |

`RemoteDispatchError` is the client error type for failed query/mutation RPC. `action.ts` remains as a thin internal module for invoke types and SSR scope helpers — prefer `getRequestEvent()` and `kiru/remote` exports for app code.

See [23-remote-functions.md](./23-remote-functions.md). [07-remote-actions.md](./07-remote-actions.md) is archived.

---

## Middleware

| Before | After |
|--------|--------|
| CSR `{ error: 403 }` effectively redirected to `/login` | **`RouteMiddlewareHttpError`** → error outlet; status preserved |
| SSR error shape | Aligned where possible with `prepareAppForUrl` |

See [05-middleware-and-navigation-guards.md](./05-middleware-and-navigation-guards.md).

---

## File-based routes

| Before | After |
|--------|--------|
| Manual `routes.ts` only | Optional **`router.fileRoutes`** codegen → `routes.gen.ts` |
| Fixed `layout.tsx`, `error.tsx`, `not-found.tsx` | Configurable **`layoutFiles`**, **`errorFiles`**, **`notFoundFiles`** |

See [04-route-tree-and-matching.md](./04-route-tree-and-matching.md).

---

## Route modules & ISR

| Before | After |
|--------|--------|
| `RouteModule` type | **`PageModule`** (layouts: **`LayoutModule`**, errors: **`ErrorModule`**, not-found: **`NotFoundModule`**) |
| `RouteLoader` type | **`PageLoader`** (or **`LayoutLoader`** / **`ErrorLoader`** / **`NotFoundLoader`** per manifest field) |
| Top-level `export const revalidate` / `tags` / `dynamic` on page modules | **`export const isr = defineISR({ … })`** only |
| `syncClientDocumentHead` | **`applyDocumentTitle`** |
| `formatModulePreloadLinks` | **`formatRouteModulePreloadLinks`** |
| `SyncPageHead` / `AsyncPageHead` | **`DynamicPageHead`** |
| `isAsyncPageHead` / `isSyncPageHead` | **`pageHeadResolveIsAsync`** (with a defined `head` and `DynamicHeadContext`) |
| `export const cache` on page modules | **Removed** — `defineISR` `revalidate` drives `Cache-Control` for now |
| `export const status` on page modules | **Removed** — SSR leaf responses use **200** until a replacement API |
| `export const headers` / `defineRouteHeaders` | **Removed** |

See [04-route-tree-and-matching.md](./04-route-tree-and-matching.md), [10-isr-hybrid-and-prerender.md](./10-isr-hybrid-and-prerender.md).

---

## Build & deploy

| Before | After |
|--------|--------|
| Implicit deploy assumptions | **`router.adapter`**: `node` \| `bun` \| `cloudflare` |
| ISR on all targets | **Cloudflare:** `assertISRAllowed` API (runtime); build **warns** via page scan today; fail on route meta at SSG build planned **S4** |

See [14-adapters-and-deploy-runtimes.md](./14-adapters-and-deploy-runtimes.md), [10-isr-hybrid-and-prerender.md](./10-isr-hybrid-and-prerender.md).

---

## Images (v2.0)

| Before | After |
|--------|--------|
| `<Image />` from `kiru`, `kiru/image`, `router.images`, `/_kiru/image` (sharp) | **Removed** — use `<img>` + static URLs; see [21-image-pipeline-adr.md](./21-image-pipeline-adr.md) |
| `createKiruHandler({ image: … })` | Option removed from `@kirujs/adapter-node` |

---

## Removed / not present on v2 branch

| Item | Notes |
|------|--------|
| **`bootstrapEnv`** | Not in codebase; no migration step |
| **Vike / `types.vike.ts` in sandbox** | Sandbox SSR reworked to Kiru handler + vite-plugin (see `sandbox/ssr/`) |
| Monolithic “one import for everything” client router | Split bootstrap + `kiru/router` server API |

---

## Testing & CI expectations

- Lib tests: `*.test.ts` **and** `*.test.tsx` via `packages/lib/scripts/test.mjs`.
- Release gate: `node builderman.js test` (packages + e2e matrix including `e2e/ssr`, `e2e/ssg`, `e2e/file-routes-*`, `e2e/ssr-matrix`).

---

## Feeds Sprint 5

- **P1-7** `MIGRATION.md` — expand sections above with copy-paste examples.
- **S5-10** `CHANGELOG.md` — [../../CHANGELOG.md](../../CHANGELOG.md) Unreleased section.

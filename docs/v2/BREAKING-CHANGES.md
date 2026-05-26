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

## Remote actions

| Before | After |
|--------|--------|
| `RemoteResult`, `fail()`, `RemoteTuple`, framework envelopes | **Passthrough JSON** — handler return value is the wire body (except `redirect(...)`) |
| `dispatch` / callables never throw | **`dispatch` throws `ActionDispatchError` on non-2xx**; callables return `Promise<Output>` |
| `actionResult()`, `setContext` / `setCookie` helpers | Handler args are split into `request` / `response`; mutate **`context`**, **`response.cookies`**, **`response.headers`** |
| `exposeErrors` JSON error bodies | Thrown / framework errors → **HTTP status only**, empty body |
| `createFormController` `fieldErrors` / `message` | **`result`** + **`error`** (transport only); read validation from your return shape |
| `action.get` / `action.post` / `action.put` / … | Single **`action()`** — RPC model, not HTTP verbs |
| JSON RPC via GET / verb-matched methods | **Always `POST`** + JSON body (`null` when empty); query via URL search params |
| `action.post({ type: "form" }, handler)` | **`action({ type: "form", handler })`** — one config object |
| Form `schema:` option | **`validation: { body: schema }`** |
| Import `redirect` in form handlers | **`redirect` on form handler args** only; JSON handlers still `import { redirect }` |

Patterns now supported and covered in e2e:

- Named exports in `*.actions.ts`
- **Default export** action object (`default-export-demo`)
- **Linked** page + `.actions.ts` module

See [07-remote-actions.md](./07-remote-actions.md).

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

## Build & deploy

| Before | After |
|--------|--------|
| Implicit deploy assumptions | **`router.adapter`**: `node` \| `bun` \| `cloudflare` |
| ISR on all targets | **Cloudflare:** `assertISRAllowed` API (runtime); build **warns** via page scan today; fail on route meta at SSG build planned **S4** |

See [14-adapters-and-deploy-runtimes.md](./14-adapters-and-deploy-runtimes.md), [10-isr-hybrid-and-prerender.md](./10-isr-hybrid-and-prerender.md).

---

## Signals (callable API)

| Before | After |
|--------|--------|
| `count.value` | `count()` — reactive read (tracks / entangles) |
| `count.value = n` | `count.set(n)` or `count.set((prev) => prev + 1)` |
| `++count.value` / `count.value++` | `count.set(count.peek() + 1)` (or read then `set`) |
| `count.peek` as property | `count.peek()` — non-tracking read |
| `new Signal(initial)` / class instances | `signal(initial)` / `computed(() => …)` return **callable** objects |
| `isSignal(x)` (`typeof x === "object"`) | `typeof x === "function" && $SIGNAL in x` |

**Unchanged (still supported):**

- **Signal-as-child:** `jsx("span", { children: count })` — pass the signal object; reconciler binds `nodeValue` and subscribes (no need to switch to `count()` or an inline fn).
- **Inline fn children:** `children: () => count()` for fine-grained updates when the parent re-runs.

Compile-time hoisting (`FLAG_HOISTED`, `dynamicChildIndices`) treats `count()` like any other non-static call; `count.peek()` does not force a dynamic slot. See [../compile-time-optimizations/static-children-and-jsx-hoisting.md](../compile-time-optimizations/static-children-and-jsx-hoisting.md).

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

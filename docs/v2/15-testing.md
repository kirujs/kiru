# Testing strategy and coverage

How Kiru v2 is tested today, where coverage is strong, and **gaps that affect launch confidence**.

---

## Test layers

| Layer | Location | Runner |
|-------|----------|--------|
| Unit | `packages/lib/src/tests/unit/*.test.ts` | `pnpm test` → `scripts/test.mjs` |
| Unit (TSX) | `packages/lib/src/tests/unit/*.test.tsx` | `pnpm test` → `scripts/test.mjs` |
| Package unit | `packages/file-routes`, `vite-plugin-kiru`, `runtime`, `adapter-contract` | per-package `pnpm test` |
| E2E | `e2e/csr`, `e2e/ssr`, `e2e/ssg`, `e2e/file-routes`, `e2e/file-routes-ssr`, `e2e/file-routes-ssg` | Cypress |
| Adapter smoke | `e2e/ssr-matrix` | Custom node scripts |

Monorepo: `node builderman.js test` (or `pnpm test` at root) orchestrates packages. Pass `--skip-e2e` to run unit/package tests only.

Builderman graph definitions live under [`scripts/builderman/`](../../scripts/builderman/) (see [`SCHEDULING.md`](../../scripts/builderman/SCHEDULING.md) for wave barriers and artifact scheduling rules).

### Cold validation (local)

Before trusting a green run, clear the builderman task cache and run the full pipeline:

```bash
rm -rf .builderman
pnpm build 2>&1 | tee build.log
pnpm test  2>&1 | tee test.log
```

Repeat **`rm -rf .builderman`** at the start of every loop iteration (after each fix, and for a final confirmation). A passing run with `cache-hit` on most tasks is not a substitute for this when validating pipeline changes.

**Builderman `test` order (high level):**

1. **`packages:build`** — `runtime` → **wave1** (`lib`, `adapter-contract`) → **post-wave1** (wave2 + adapters in parallel) → `vite-plugin-kiru`.
2. **`packages:test`** — unit tests in parallel (`maxConcurrency` = CPU count): `lib:test`, `file-routes:test`, adapters, `vite-plugin-kiru:test`, etc.
3. **`e2e`** — starts only after **`packages:test`** succeeds. Flat **`e2e:cypress`** shard pool (parallel locally, serial on GHA) plus **`e2e:ssr-matrix`**. Cypress scheduling depends on `packages:build` via `packagesForE2e`.

### Cold benchmark (Windows, full suite)

Measured with `rm -rf .builderman && pnpm test` (May 2026):

| Config | Wall time | Notes |
|--------|-----------|--------|
| Before package DAG / overlap tuning | ~315–366s | Baseline after first parallel Cypress work |
| Default (`KIRU_E2E_CONCURRENCY` 2, matrix after Cypress) | ~317–336s | Stable default |
| Fast local (`KIRU_E2E_CONCURRENCY=3`) | ~264s | ~4.4 min; SSR loader shard may flake under load — retry or use `=2` |

Parse timings: `node scripts/parse-builderman-timings.mjs test.log`

**Faster local cold (optional):**

```bash
rm -rf .builderman
KIRU_E2E_CONCURRENCY=3 pnpm test 2>&1 | tee test.log
```

Locally, `e2e` may overlap Cypress with matrix (no `maxConcurrency` cap on the `e2e` parent). On GHA, `GITHUB=true` forces serial Cypress and `e2e` `maxConcurrency: 1`.

**Concurrency knobs:**

| Env | Scope | Default |
|-----|-------|---------|
| `KIRU_E2E_CONCURRENCY` | Cypress builderman tasks (local only) | `min(cpus, 12)`. Override down (e.g. `3`) if loader hydration tests flake under load. |
| `GITHUB=true` | Cypress on GitHub Actions | **always serial** (`maxConcurrency: 1`; ignores `KIRU_E2E_CONCURRENCY`) |
| `KIRU_MATRIX_CONCURRENCY` | SSR matrix Node/Bun cells | `min(cpus, 4)` on CI, **`3`** locally |
| `KIRU_MATRIX_WRANGLER_CONCURRENCY` | SSR matrix Worker cells | `2` on Linux CI, `1` elsewhere |
| `KIRU_LIB_TEST_CONCURRENCY` | `packages/lib` `node --test` | `min(cpus, 12)` |

### Parallel Cypress shards (`e2e/ssr`, `e2e/csr`, …)

Long-running apps are split into **flat builderman tasks** (separate Vite dev servers on fixed ports in [`e2e/shared/ports.mjs`](../../e2e/shared/ports.mjs)). Do not reuse ports across shards. `e2e:ssr:build` is the **only** task that writes `e2e/ssr/dist`; Cypress shards and `e2e:ssr:verify` are read-only consumers (`cache.outputs: []`).

| App | Builderman tasks | Ports (dev / hmr) |
|-----|------------------|-------------------|
| `e2e/ssr` | `e2e:ssr:build`, `e2e:ssr:verify`, `e2e:ssr:cy-{loaders,streaming,actions,tier3,core}` | core 5192/8022, loaders 5196/8025, streaming 5197/8029, actions 5195/8026, tier3 prod 5193 |
| `e2e/csr` | `e2e:csr:cy-{core,features,advanced}` | core 5173/8003, features 5180/8027, advanced 5181/8028 |
| other Cypress apps | `e2e:ssg:build` + `e2e:ssg`, `e2e:file-routes-ssg:build` + `e2e:file-routes-ssg`, `e2e:file-routes`, `e2e:compile-opts`, `e2e:primitive`, `e2e:dom` | see `ports.mjs` |

`e2e:vite-builds` runs `e2e:ssg:build` and `e2e:file-routes-ssg:build` in parallel before Cypress. SSG / file-routes-ssg package `test` scripts are Cypress-only (no nested `pnpm build`).

**SSR specs:** `ssr-core.cy.ts`, `ssr-loaders.cy.ts`, `ssr-streaming.cy.ts`, `ssr-actions.cy.ts` (plus `home-hydration-proof.cy.ts` on core). **`debug-*.cy.ts`** are excluded from default runs — use `cd e2e/ssr && pnpm cy:debug`.

**Local single shard:** `pnpm --filter e2e-ssr test:shard-streaming`, `pnpm --filter e2e-csr test:shard-features`, etc.

**GitHub Actions:** same shard graph as local; build log prints `Cypress tasks: serial (GITHUB=true)` at startup.

### `e2e/ssr-matrix` parallelism

- Each cell builds to `dist/cells/<cellId>/` so cells can run concurrently.
- `KIRU_MATRIX_CONCURRENCY` (default min(cpus, 4) on CI) for Node/Bun cells; `KIRU_MATRIX_WRANGLER_CONCURRENCY` (default 2 on Linux CI, 1 elsewhere) for Worker cells.
- Builderman runs `e2e:ssr-matrix` via `scripts/matrix.mjs` **alongside** the Cypress pool on Linux CI (`e2e` `maxConcurrency: 2`); on Windows the matrix waits for Cypress to finish (`maxConcurrency: 1`). Per-cell Vite `cacheDir` and HMR ports (8040–8052) avoid websocket port clashes during cell builds.
- `e2e:ssr:build` on test uses `scripts/ensure-ssr-build.mjs` to skip vite build when `dist/` already exists from `pnpm build`.
- Builderman exits non-zero when any task fails (`process.exit(1)` if `!result.ok`).
- Cypress shard configs disable Vite HMR websockets by default (`createViteCypressConfig`); only `e2e/csr` advanced/HMR specs enable HMR. `e2e/ssr-matrix` sets `server.hmr: false` for parallel `vite build`.

---

## Lib test runner (`.test.ts` + `.test.tsx`)

`packages/lib/scripts/test.mjs` collects both `*.test.ts` and `*.test.tsx` and maps outfiles with `\.tsx?$` → `.js`.

**Previously skipped** (now in default `pnpm test`):

| File | Approximate coverage |
|------|---------------------|
| `router.test.tsx` | **Largest** — manifest, renderer, streaming, ISR, middleware CSR, errors, sitemap |
| `ssr-streaming.test.tsx` | Stream head / shell |
| `rendererPprDynamic.test.tsx` | force-static / force-dynamic |
| `routerShellTree.test.tsx` | Shell parity |
| `clientErrorOutlet.test.tsx` | Client error UI |
| `resource-streaming.test.tsx` | Resource + stream |
| Others | DOM/reconciler |

Fixed 2026-05-22 (Sprint 1). Treat green `packages/lib` `pnpm test` as covering router/renderer TSX suites.

---

## Bootstrap-aware unit tests

`test.mjs` sets `__KIRU_ROUTER_BOOTSTRAP__` per file path:

| Pattern in path | Define |
|-----------------|--------|
| `guard-ssg`, `ssg.` | `ssg` |
| `guard-ssr`, `remote-ssr`, `ssr.` | `ssr` |
| default | `csr` |

Used by `devWarnings.*.test.ts` and env guards.

---

## Strong unit areas (`.test.ts` — actually run)

| Area | Files |
|------|-------|
| Remote / actions | `remote.test.ts`, `actionMiddleware.test.ts`, `formActions.test.ts`, `formController.*.test.ts` |
| Loaders cache | `loaderCache.test.ts`, `loaderStale.test.ts`, `loaderRegistry.test.ts` |
| i18n | `i18n.test.ts`, `localeRouting.test.ts` |
| Routing | `manifest-routing.test.ts`, `routePaths.test.ts`, `pathPolicy.test.ts` |
| Middleware | `routeMiddleware.test.ts` (2 tests), `collectRouteMiddlewareModule.test.ts` |
| Revalidate | `revalidate.test.ts`, `prerenderCache.test.ts` |
| Abort | `navigationAbort.test.ts`, `ssrAbort.test.ts`, `ssgAbort.test.ts` |
| Hydrate dispatch | `routerHydrate.dispatch.test.ts` |
| Bootstrap smoke | `routerBootstrap.test.ts` (4 tests) |

---

## E2E coverage (Cypress)

Approximate `it()` counts:

| App | Count | Focus |
|-----|-------|-------|
| `e2e/ssr` | ~65 | Loaders, prefetch, history, forms, actions, streaming, ISR, i18n, tier3 |
| `e2e/csr` | ~62 | Signals, routing, loaders, VT, HMR |
| `e2e/ssg` | ~30 | Static nav, i18n, images, parity (`ssg-parity.cy.ts`) |
| `e2e/file-routes` | 7 | Codegen, middleware redirect, groups (CSR) |
| `e2e/file-routes-ssr` | 4 | FBR SSR full load + client nav |
| `e2e/file-routes-ssg` | 4 | FBR SSG prerender + client nav |

**ssr-matrix** — multi-server smoke (not Cypress) — critical for adapter regressions.

---

## Missing or weak scenarios

### Must add before launch

1. **CSR middleware `{ error: 403 }`** — expect not `/login` redirect (will fail until fixed)
2. **Middleware `{ error }` on SSR** — status body in response
3. **Include `router.test.tsx` in CI**
4. **SSG client nav + serverLoader** — if supported by hybrid; else document as unsupported
5. **ActionFailure UI** in browser
6. **`invalidate()` after action** — loader refetch visible in DOM

### Should add soon

| Scenario | Why |
|----------|-----|
| File-routes + hybrid build | Codegen + ISR interaction |
| Cloudflare Worker smoke in CI | Edge regressions |
| Hash-only navigation SSR | Hydration stash regression |
| Concurrent navigation abort | Stale loader commit |
| `force-static` 404 without prerender file | PPR contract |

### Nice to have

- Visual regression for head/meta
- Load test loader RPC endpoint
- Fuzz for `matchRoute` patterns

---

## E2E parallel diagnostics

Opt-in instrumentation to compare Cypress concurrency (e.g. cy=2 vs cy=6) and classify loader flakes.

| Env | Purpose |
|-----|---------|
| `KIRU_E2E_DIAG=1` | Cypress/Vite timing JSONL under `.e2e-diag/`, builderman startup log |
| `KIRU_E2E_DIAG_FILTER=ssr` | SSR Cypress shards only (no matrix / other apps) |
| `KIRU_RPC_TRACE=1` | Unified loader/action RPC trace in `packages/lib` |
| `KIRU_RPC_TRACE_FILE` | Server-side JSONL (default set by diag runner per experiment) |
| `KIRU_E2E_DIAG_INTERVAL_MS` | Sampler interval (default 500) |

```bash
# Focused SSR experiments + report
node scripts/run-e2e-diag-suite.mjs

# Re-analyze after manual runs
node scripts/analyze-e2e-diag.mjs
```

In the browser during a diag run: `window.dumpKiruDiagnostics()` / `window.__kiruDumpRpcTrace()`.

See also [07-remote-actions.md](./07-remote-actions.md#diagnostics).

### Parallel Cypress loader flakes (troubleshooting)

When multiple SSR Cypress shards run at once, each shard uses its own Vite `cacheDir` (e.g. `node_modules/.vite-cypress-5196`). The dev loader manifest (`kiru-loader-modules.json`) is written under that directory so shards do not race on a shared `node_modules/.vite/` file (which caused `handler_missing` / HTTP 500 on `?loader=` RPC).

Stress repro after changes:

```bash
node scripts/investigate-loader-flake.mjs --iterations=5
```

---

## Running tests locally

```bash
# Full monorepo
node builderman.js test

# Lib only
cd packages/lib && pnpm test

# Single e2e app or shard
cd e2e/ssr && pnpm test:shard-core
cd e2e/csr && pnpm test:shard-advanced
cd e2e/ssr && pnpm cy:debug   # diagnostic specs only

# Fast CI-style unit pass (no e2e)
node builderman.js test --skip-e2e
```

Lib tests require `pretest` build (`tsc`).

---

## Sandbox manual QA

`sandbox/ssr` — login, todos, account, cookie sessions — manual demo for auth + actions.

---

## Test utilities

- `packages/lib/src/tests/unit/jsdom.ts` — DOM setup
- `packages/lib/src/tests/unit/utils.ts` — shared helpers

---

## Definition of done (router v2)

- [ ] All `*.test.tsx` in lib run in CI
- [ ] CSR/SSR middleware error parity tested
- [ ] E2E covers default-export actions + linked actions (in progress in branch)
- [ ] ssg e2e count increased for hybrid regressions
- [x] file-routes e2e on CSR, SSR (`e2e/file-routes-ssr`), and SSG (`e2e/file-routes-ssg`)

---

## Further reading

- [16-gaps-risks-and-launch-checklist.md](./16-gaps-risks-and-launch-checklist.md)
- [05-middleware-and-navigation-guards.md](./05-middleware-and-navigation-guards.md)

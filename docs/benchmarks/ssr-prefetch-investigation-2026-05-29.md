# SSR loader prefetch investigation (2026-05-29)

## Scope

Flaky failure in `e2e/ssr/cypress/e2e/ssr-loaders.cy.ts`:

- test: `prefetches server loader data on link hover before navigation`
- assertions: exactly **one** `POST ?loader=` for `/loaders/server` after hover, and still **one** total after click

Observed failure modes:

| Mode | Assertion site | Expected | Actual | When |
|------|----------------|----------|--------|------|
| **A** | line 85 (post-click) | 1 | **2** | User report; isolated loaders shard |
| **B** | line 74 (post-hover) | 1 | **0** | Parallel stress (loaders ∥ core ∥ streaming) |

## Environment

- Node: `v22.22.0`
- Cypress: `15.16.0`
- OS: Windows 11
- Builderman local concurrency: `8` (Cypress profile isolation enabled)

## Runs performed (2026-05-29, second pass)

### 1) Cold build + full diag test

```bash
rm -rf .builderman .e2e-diag
pnpm build
KIRU_E2E_DIAG=1 pnpm test
```

Result: **PASS** (~208s wall). Loaders shard prefetch test passed in ~3.5s (`events-5196.jsonl`, no `loader_assert_fail`).

Note: `KIRU_E2E_DIAG=1` enables RPC trace globally; unit test `rpcTrace` needed a test-only override fix so `packages:test` does not fail when diag is on.

### 2) Parallel stress (repro)

```bash
node scripts/investigate-loader-flake.mjs --iterations=10
```

Result: **FAIL on iteration 1** with loaders + core + streaming Cypress shards in parallel.

Loaders shard failures:

1. **Prefetch test** — `expected 0 to equal 1` at line 74 (no matching intercept after hover, 10s timeout).
2. **History test** — `cy.wait('@serverLoader')` timeout (no intercept-visible loader POST).

Core shard also saw loader `cy.wait` timeouts under the same parallel burst.

Loader RPC server-side latency during stress: **~2s** for `route:6:load` (`loader_invoke_end 2009ms`, `2001ms` in loaders.log) while three Vite SSR dev servers run concurrently.

## Diagnostic evidence (`.e2e-diag/events-5196.jsonl`)

### Failure B — hover wait, count 0 (parallel stress)

`loader_assert_fail` RPC timeline (client, prefetch test):

```
prefetch_start (hover)
prefetch_chunks
prefetch_load_tree
prefetch_loader_invoke
page_load_start route:5 /loaders/server
cache_miss
loader_rpc_dispatch
page_load_done source=fetch
prefetch_done
```

Loader cache after failure: entry present for `route:5|||/loaders/server|||` (`staleTime: 0`).

**Interpretation:** Kiru client believes prefetch completed a successful server-loader fetch and seeded cache, but Cypress `@loaderPost` saw **zero** matching intercepts within 10s. Either the HTTP POST was not visible to Cypress under load, or intercepts arrived but `serverLoaderPostCount()` filtered them all out (no `interceptions` payload captured today).

### Failure A pattern — double fetch (from history-test dump, same stress run)

Same spec file; click/hover race on `/loaders/server`:

```
pointerenter + prefetch_start + prefetch_chunks
click (+8ms later, before prefetch_load_tree)
navigation page_load_start → cache_miss → fetch  (1st network load)
prefetch_load_tree → prefetch_loader_invoke → cache_hit (prefetch completes after nav started)
```

**Interpretation:** Navigation can win the race against in-flight hover prefetch. That yields a **network fetch on click** even when hover prefetch was started; a second client-side path may still run afterward. Matches user report (**2 POSTs**, expected 1 total after click).

### Cold pass — success

Same diag channel on pass: hover prefetch completes, single loader RPC, cache hit on subsequent navigation (no `loader_assert_fail` entry).

## Root cause analysis

### Primary: load-sensitive race (real product + test timing)

Under parallel local e2e (multiple SSR Vite dev servers + Cypress browsers):

1. SSR loader RPC latency spikes (multi-second server invokes observed).
2. Hover prefetch is async (`prefetchRoute` → `loadRouteTree` → `resolvePagePropsFromModule`).
3. Navigation does **not** await an in-flight prefetch for the same href before starting its own page load.
4. Outcomes:
   - **Double POST:** prefetch + navigation both miss cache and dispatch RPC (user mode A).
   - **Missed intercept:** client trace shows dispatch/`page_load_done` but Cypress sees 0 POSTs within timeout (mode B — possibly hung/slow HTTP or intercept visibility under saturation; needs raw intercept dump to confirm).

This is **not** a Vite manifest shard collision (per-port `cacheDir` already isolates `kiru-loader-modules.json`). It **is** correlated with **CPU/SSR contention** when Cypress concurrency is high.

### Secondary: test harness gaps

- `serverLoaderPostCount()` only inspects intercept bodies; failures do not log raw `@loaderPost.all` bodies/URLs today.
- Hover uses `cy.trigger('pointerenter')` (synthetic); no wait for `prefetch_done` in RPC trace.
- Post-click assertion assumes navigation always reuses prefetch cache (true when cold/serial; false under race).

### Not the cause (ruled out this pass)

- Cypress 15 Windows profile EPERM (mitigated; cold parallel test green).
- Counting `/loaders/server-immediate-shell` as target (excluded in test filter).
- Default Link `visible` prefetch (default trigger remains `hover`; `onMount('visible')` is a no-op).

## Conclusion

| Question | Answer |
|----------|--------|
| Reproducible? | **Yes**, under parallel SSR shard stress; **no** on cold serial/full builderman pass in this session |
| Product bug? | **Likely:** navigation should coalesce with in-flight prefetch for the same href (dedupe flight, or await prefetch before dispatching loader RPC on navigate) |
| Test bug? | **Partially:** assertions are brittle under parallel load; need richer failure captures |
| Recommended concurrency | Keep `KIRU_E2E_CONCURRENCY` ≤ 4 on Windows for loader-heavy work, or serialize `e2e:ssr:cy-loaders` |

## Recommended next steps (not implemented here)

1. ~~**Product:** In navigation/page-load path, if `prefetchFlightByHref` has an in-flight promise for the target href, await it before `cache_miss` → fetch.~~ **Done (2026-05-29):** `awaitInFlightPrefetch` in `buildClientOutletSubtree`; `loaderClient` single-flight RPC dedupe.
2. **Test:** After hover, wait for `@loaderPost` **and** optionally `cy.window().its('__kiruDumpRpcTrace')` to include `prefetch_done` before click; log full intercept URLs/bodies on failure.
3. **Diag:** Include `interceptions` in every `loader_assert_fail` (pass `@loaderPost.all` from the failing assertion).
4. **CI/local:** Document that loaders shard flakes rise when run parallel to core/streaming; consider builderman dependency edge so loaders runs with lower fan-out or after SSR shards.

# Testing strategy and coverage

How Kiru v2 is tested today, where coverage is strong, and **gaps that affect launch confidence**.

---

## Test layers

| Layer | Location | Runner |
|-------|----------|--------|
| Unit | `packages/lib/src/tests/unit/*.test.ts` | `pnpm test` → `scripts/test.mjs` |
| Unit (TSX) | `packages/lib/src/tests/unit/*.test.tsx` | **Not in default runner** |
| Package unit | `packages/file-routes`, `vite-plugin-kiru`, `runtime`, `adapter-contract` | per-package `pnpm test` |
| E2E | `e2e/csr`, `e2e/ssr`, `e2e/ssg`, `e2e/file-routes` | Cypress |
| Adapter smoke | `e2e/ssr-matrix` | Custom node scripts |

Monorepo: `node builderman.js test` orchestrates packages.

---

## Critical gap: `.test.tsx` excluded from lib test runner

`packages/lib/scripts/test.mjs` only collects `*.test.ts`:

```javascript
} else if (name.endsWith(".test.ts")) {
  acc.push(path)
}
```

**Not executed in CI** unless another job runs them:

| File | Approximate coverage |
|------|---------------------|
| `router.test.tsx` | **Largest** — manifest, renderer, streaming, ISR, middleware CSR, errors, sitemap |
| `ssr-streaming.test.tsx` | Stream head / shell |
| `rendererPprDynamic.test.tsx` | force-static / force-dynamic |
| `routerShellTree.test.tsx` | Shell parity |
| `clientErrorOutlet.test.tsx` | Client error UI |
| `resource-streaming.test.tsx` | Resource + stream |
| Others | DOM/reconciler |

**Recommendation:** Extend collector to `.test.tsx` or rename/move tests to `.test.ts`. Until fixed, treat green `packages/lib` CI as **incomplete** for router v2.

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
| Remote / actions | `remote.test.ts`, `formActions.test.ts`, `formController.*.test.ts` |
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
| `e2e/ssg` | ~18 | Static nav, i18n, images |
| `e2e/file-routes` | 7 | Codegen, middleware redirect, groups |

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

## Running tests locally

```bash
# Full monorepo
node builderman.js test

# Lib only
cd packages/lib && pnpm test

# Single e2e app
cd e2e/ssr && pnpm test  # see package.json scripts
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
- [ ] file-routes e2e extended to SSR fixture OR documented CSR-only

---

## Further reading

- [16-gaps-risks-and-launch-checklist.md](./16-gaps-risks-and-launch-checklist.md)
- [05-middleware-and-navigation-guards.md](./05-middleware-and-navigation-guards.md)

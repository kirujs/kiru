# Gaps, risks, and launch checklist

Consolidated **ship blockers**, **important gaps**, and a prioritized checklist for Kiru v2 public release. Derived from implementation review of the monorepo.

---

## Executive summary

Kiru v2 is **feature-complete enough** to compete as a signal-based full-stack framework for teams that want loaders, actions, SSR/SSG, and hybrid ISR without RSC.

Launch credibility requires fixing **CSR middleware error handling**, **running the full router test suite in CI**, and **closing SSR/SSG client outlet parity** tests.

---

## Ship blockers (P0)

### P0-1 — CSR middleware `{ error }` ~~hardcoded to `/login`~~ **Fixed (2026-05-22)**

Client navigations commit the target URL, set `outletRenderError` with `RouteMiddlewareHttpError`, and return `navigate()` status `errored`. See [05-middleware-and-navigation-guards.md](./05-middleware-and-navigation-guards.md).

---

### P0-2 — `*.test.tsx` not executed by `packages/lib` test runner **Fixed (2026-05-22)**

`packages/lib/scripts/test.mjs` collects `*.test.ts` and `*.test.tsx`. See [15-testing.md](./15-testing.md).

---

### P0-3 — Document and test dual client outlet paths **Mitigated (2026-05-22, Sprint 2)**

**Decision:** Keep dual outlets (`RouterView` vs `subscribeSsrClientOutlet`); shared tree build in `clientRoutePrep.ts`.

**Fixes:** `tryClearClientNavigation` / `isLoaderPending` on SSR outlet; `outletRenderError` subscription; stale refresh guard in `routerHydrate.ts`.

**Tests:** `prepareAppForUrl.test.ts` (5 cases), `routerHydrate.middlewareError.test.ts`, `e2e/csr/cypress/e2e/parity.cy.ts`, expanded SSG e2e (hash, forbidden, history). Parity checklist in [09-client-bootstrap-and-hydration.md](./09-client-bootstrap-and-hydration.md).

**Deferred:** SSR Cypress client-nav middleware UI (covered by lib jsdom + CSR e2e + HTTP 403); link prefetch hover (S3).

---

## High priority (P1)

| ID | Gap | Notes |
|----|-----|-------|
| P1-1 | No e2e for middleware `{ error }` | Add SSR + CSR cases after P0-1 |
| P1-2 | SSG e2e thinner than SSR | ~18 vs ~65 tests — expand hybrid + static loader nav |
| P1-3 | ~~FBR e2e: CSR only~~ | Done — `e2e/file-routes-ssr`, `e2e/file-routes-ssg` (Sprint 3) |
| P1-12 | ~~FBR special filenames hardcoded~~ | Done — `layoutFiles`, `errorFiles`, `notFoundFiles` (Sprint 3) |
| P1-4 | ~~Cloudflare ISR story~~ | Done — build fail on route meta (S4); `cloudflare-smoke` CI job |
| P1-5 | No global `middleware.ts` | Document root scope pattern; consider codegen |
| P1-6 | Multiplexed `?action` / `?loader` | Publish security whitepaper for adopters |
| P1-7 | Version / migration | Package `1.5.3` vs v2 branding — migration guide from v1 |
| P1-13 | Hydration chunk prewarm | **Done (S6)** — `modulepreload` first paint + Link hover; [22-hydration-module-prewarm-adr.md](./22-hydration-module-prewarm-adr.md) |

---

## Medium priority (P2)

| ID | Gap | Notes |
|----|-----|-------|
| P2-1 | No first-party Vercel/Netlify adapter | Document Node serverless + static export paths |
| P2-2 | No REST `/api` routes | BYO framework mount or second server |
| P2-3 | No RSC / partial hydration | Positioning only — not a bug |
| P2-4 | `experimental.staticHoisting` off | Performance story vs safety |
| P2-5 | Content/MDX layer | Ecosystem gap vs Nuxt |
| P2-6 | prepareAppForUrl complexity | Hard to maintain — needs integration tests when TSX runs |
| P2-7 | Configurable static 404 / host fallback strategies | Analysis in [19-static-404-and-host-fallback-strategies.md](./19-static-404-and-host-fallback-strategies.md); code: `notFoundStrategy`, rewrite codegen |
| P2-8 | CSRF: warn on `allowedOrigins: ["*"]` in production | S4 tests + S6 SECURITY.md; stricter default deferred |
| P2-9 | Optional CSRF nonce API | Post-v2 for regulated adopters |

---

## Low priority (P3)

- OG image generation route (after [21-image-pipeline-adr.md](./21-image-pipeline-adr.md) phase 3)
- Service worker / PWA kit
- ICU i18n
- Parallel/intercepting routes
- Draft mode / preview URLs

---

## Risk register

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| CSR middleware error bug in production auth | High | High | P0-1 + e2e |
| CI false confidence | High | High | P0-2 |
| SSR/CSR behavior drift | Medium | High | P0-3 tests |
| Edge users enable ISR tags | Low | Medium | Build assert + docs |
| Loader RPC abuse | Low | High | Origin + token docs, rate limit at adapter |
| Hash hydration mismatch | Low | Medium | Regression test |
| FBR regressions only caught on CSR | Medium | Medium | P1-3 SSR + SSG e2e |
| FBR naming mismatch vs app conventions | Low | Low | P1-12 configurable special files |
| Wrong static fallback on edge (parent index.html for 404) | Low | Medium | P2-7 docs + opt-in `nearest-asset`; default `hybrid-ssr` / `exact` |

---

## Launch checklist

### Code correctness

- [x] Fix CSR middleware error handling
- [x] Run `router.test.tsx` in CI green
- [x] Verify remote action API stable (default export, `ActionFailure`) — S0-1 / S3 e2e
- [x] `assertISRAllowed` runtime API + unit tests (S0-3); vite-plugin build fail on Cloudflare route meta (S4)

### Testing

- [x] E2e: middleware error SSR + CSR
- [x] E2e: action invalidate + loader refetch (SSR `invalidate-demo`)
- [x] E2e: default-export actions (e2e pages in branch)
- [x] ssr-matrix green on CI (builderman `e2e:ssr-matrix`)
- [x] SSG hybrid script: `e2e/ssr/scripts/verify-hybrid-prerender.mjs` (runs in `e2e:ssr`)
- [x] **P1-3** E2e: file-based routes on SSR and SSG
- [x] **P1-12** FBR: configurable `layout` / `error` / `not-found` filename patterns

### Documentation (this folder)

- [x] Topic guides under `docs/v2/`
- [ ] kirujs.dev sync (out of repo scope)
- [ ] Minimal “start here in 10 minutes” tutorial

### Product

- [ ] `create-kiru` templates match bootstrap imports
- [ ] One golden Node deploy sample
- [ ] One golden Cloudflare Worker sample
- [x] Changelog v2 breaking changes — draft in [CHANGELOG.md](../../CHANGELOG.md); inventory in [BREAKING-CHANGES.md](./BREAKING-CHANGES.md)

### Positioning

- [ ] Clear “not Next/RSC” statement
- [ ] Cloudflare capability matrix on deploy page
- [ ] Comparison table for evaluators ([02-competitive-positioning.md](./02-competitive-positioning.md))

---

## Suggested fix order (sprints)

See **[18-release-sprint-todos.md](./18-release-sprint-todos.md)** for the full sprint plan (S0–S6), per-task checkboxes, acceptance criteria, and v2.0.0 definition of done.

**Summary:**

| Sprint | Focus |
|--------|--------|
| S0 | ~~Stabilize branch~~ **done** — actions API, ISR build checks, CHANGELOG draft |
| S1 | ~~Trust~~ **done** — test runner + CSR middleware fix |
| S2 | Client parity — outlet matrix + integration tests |
| S3 | E2E & hybrid — SSG, FBR SSR/SSG e2e (P1-3), FBR special filenames (P1-12), matrix CI |
| S4 | Edge & security — Cloudflare CI, ISR build fail, RPC test hardening |
| S5 | ~~API & router depth~~ **done** — ADRs 20–21, image removal, `prepareAppForUrl` refactor |
| S6 | Release kit — docs, recipes, kirujs.dev, migration, deploy guides |

---

## Further reading

- [18-release-sprint-todos.md](./18-release-sprint-todos.md)
- [19-static-404-and-host-fallback-strategies.md](./19-static-404-and-host-fallback-strategies.md)
- [02-competitive-positioning.md](./02-competitive-positioning.md)
- [15-testing.md](./15-testing.md)
- [05-middleware-and-navigation-guards.md](./05-middleware-and-navigation-guards.md)

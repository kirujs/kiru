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

### P0-3 — Document and test dual client outlet paths

**Problem:** CSR uses `RouterView` + `resource()`; SSR/SSG uses signal outlet + subscriptions. Fixes can land in one path only.

**Impact:** Hydration/nav/invalidate bugs exclusive to SSR or CSR.

**Fix:** Shared integration tests post-hydrate, or unify outlet implementation.

**Docs:** [09-client-bootstrap-and-hydration.md](./09-client-bootstrap-and-hydration.md)

---

## High priority (P1)

| ID | Gap | Notes |
|----|-----|-------|
| P1-1 | No e2e for middleware `{ error }` | Add SSR + CSR cases after P0-1 |
| P1-2 | SSG e2e thinner than SSR | ~18 vs ~65 tests — expand hybrid + static loader nav |
| P1-3 | File-routes only CSR e2e | Add SSR/hybrid fixture or scope docs “CSR verified” |
| P1-4 | Cloudflare ISR story | Build-time assert exists; need Worker smoke in CI |
| P1-5 | No global `middleware.ts` | Document root scope pattern; consider codegen |
| P1-6 | Multiplexed `?action` / `?loader` | Publish security whitepaper for adopters |
| P1-7 | Version / migration | Package `1.5.3` vs v2 branding — migration guide from v1 |

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

---

## Low priority (P3)

- OG image generation route
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

---

## Launch checklist

### Code correctness

- [x] Fix CSR middleware error handling
- [x] Run `router.test.tsx` in CI green
- [ ] Verify remote action API stable (default export, `ActionFailure`)
- [ ] `assertISRAllowed` passes on all cloudflare builds

### Testing

- [ ] E2e: middleware error SSR + CSR
- [ ] E2e: action invalidate + loader refetch
- [ ] E2e: default-export actions (e2e pages in branch)
- [ ] ssr-matrix green on CI
- [ ] SSG hybrid script: `e2e/ssr/scripts/verify-hybrid-prerender.mjs`

### Documentation (this folder)

- [x] Topic guides under `docs/v2/`
- [ ] kirujs.dev sync (out of repo scope)
- [ ] Minimal “start here in 10 minutes” tutorial

### Product

- [ ] `create-kiru` templates match bootstrap imports
- [ ] One golden Node deploy sample
- [ ] One golden Cloudflare Worker sample
- [ ] Changelog v2 breaking changes

### Positioning

- [ ] Clear “not Next/RSC” statement
- [ ] Cloudflare capability matrix on deploy page
- [ ] Comparison table for evaluators ([02-competitive-positioning.md](./02-competitive-positioning.md))

---

## Suggested fix order (sprints)

See **[18-release-sprint-todos.md](./18-release-sprint-todos.md)** for the full sprint plan (S0–S5), per-task checkboxes, acceptance criteria, and v2.0.0 definition of done.

**Summary:**

| Sprint | Focus |
|--------|--------|
| S0 | Stabilize branch, actions API, ISR build checks |
| S1 | Trust — test runner + CSR middleware fix |
| S2 | Client parity — outlet matrix + integration tests |
| S3 | E2E & hybrid — SSG, file-routes, matrix CI |
| S4 | Release kit — migration, templates, deploy docs |
| S5 | Edge & security — Cloudflare + SECURITY.md |

---

## Further reading

- [18-release-sprint-todos.md](./18-release-sprint-todos.md)
- [02-competitive-positioning.md](./02-competitive-positioning.md)
- [15-testing.md](./15-testing.md)
- [05-middleware-and-navigation-guards.md](./05-middleware-and-navigation-guards.md)

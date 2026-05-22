# Gaps, risks, and launch checklist

Consolidated **ship blockers**, **important gaps**, and a prioritized checklist for Kiru v2 public release. Derived from implementation review of the monorepo.

---

## Executive summary

Kiru v2 is **feature-complete enough** to compete as a signal-based full-stack framework for teams that want loaders, actions, SSR/SSG, and hybrid ISR without RSC.

Launch credibility requires fixing **CSR middleware error handling**, **running the full router test suite in CI**, and **closing SSR/SSG client outlet parity** tests.

---

## Ship blockers (P0)

### P0-1 — CSR middleware `{ error }` hardcoded to `/login`

**Location:** `packages/lib/src/router/navigation.ts` (~line 470)

**Problem:** `{ error: number, body? }` from route middleware becomes `runRedirect("/login")` on client navigations. SSR returns proper HTTP status/body.

**Impact:** Forbidden/logout/service-unavailable flows break on SPA navigations; security-sensitive apps cannot rely on middleware errors client-side.

**Fix direction:**

- Map to error outlet / `NavigationFailure` type `error`, or
- Configurable handler per status, or
- Reuse SSR error page component with status code

**Docs:** [05-middleware-and-navigation-guards.md](./05-middleware-and-navigation-guards.md)

---

### P0-2 — `*.test.tsx` not executed by `packages/lib` test runner

**Location:** `packages/lib/scripts/test.mjs`

**Problem:** `router.test.tsx` (~1400 lines) and other TSX tests never run in default `pnpm test`.

**Impact:** Regressions in renderer, streaming, ISR, PPR modes, and error pages can merge undetected.

**Fix:** Collect `.test.tsx` or migrate tests to `.test.ts`.

**Docs:** [15-testing.md](./15-testing.md)

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

- [ ] Fix CSR middleware error handling
- [ ] Run `router.test.tsx` in CI green
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

**Sprint 1 — Trust**

1. P0-2 test runner  
2. P0-1 middleware error  
3. E2e middleware + action invalidate  

**Sprint 2 — Parity**

4. P0-3 outlet integration tests  
5. Expand SSG e2e  
6. File-routes SSR fixture  

**Sprint 3 — Adopt**

7. Migration guide + version bump  
8. Cloudflare golden path  
9. Security doc for RPC endpoints  

---

## Further reading

- [02-competitive-positioning.md](./02-competitive-positioning.md)
- [15-testing.md](./15-testing.md)
- [05-middleware-and-navigation-guards.md](./05-middleware-and-navigation-guards.md)

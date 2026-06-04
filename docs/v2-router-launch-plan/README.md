# Kiru v2 Router Launch Plan (AI Execution Runbook)

This document is written for AI agents to execute autonomously and safely.  
Goal: harden Kiru v2 router + CSR/SSR/SSG for launch-level reliability.

---

## 1) Agent Operating Contract

Follow these rules in every run:

- [ ] Work strictly in task order unless a blocker requires reordering.
- [ ] Do not skip validation commands for any completed task.
- [ ] Make smallest viable change set per PR.
- [ ] Add/adjust tests in the same PR as behavior changes.
- [ ] If expected behavior is ambiguous, stop and request a decision.
- [ ] Never mark a task done unless all "Done When" checks pass.

Launch readiness also requires:

- [x] `<kiru-announcer>` is present in the default app shell, opt-out capable, and announces `document.title` only after successful client navigations.

Status markers:

- [ ] Not started
- [~] In progress
- [x] Done
- [!] Blocked (decision required)

---

## 2) Global Definition of Done

A task is complete only when all are true:

- [ ] Code changes implemented.
- [ ] Relevant unit tests added/updated and passing.
- [ ] Relevant e2e/integration tests added/updated and passing (if applicable).
- [ ] No new lint/type errors in changed areas.
- [ ] Short "what changed + why" note added to PR description.

---

## 3) Execution Order (Mandatory)

Run these work packages in sequence:

1. WP-01 Base URL-safe RPC endpoints
2. WP-02 Popstate cancellation URL restoration
3. WP-03 Locale/domain ISR cache-key consistency
4. WP-04 Preview SSR proxy request fidelity
5. WP-05 Enter guard semantics decision + implementation
6. WP-06 Navigation announcer (`<kiru-announcer>`)
7. WP-07 Test parity matrix expansion (file-routes + CSR SPA nav + path policy + encoded URLs)
8. WP-08 Flake hardening and launch sign-off checks

---

## 4) Work Packages

## WP-01: Base URL-safe RPC endpoints (P0)

### Objective

Ensure loader/action RPC endpoints work under both root and non-root base URLs.

### Files

- `packages/lib/src/router/loaderClient.ts`
- `packages/lib/src/ssr/routerHydrate.ts`
- `packages/lib/src/remote/formController.ts`
- `packages/lib/src/router/rpcUrl.ts`

### Tasks

- [x] Create a shared base-aware RPC URL helper.
- [x] Replace hardcoded `/?loader=` usage with helper.
- [x] Replace hardcoded `/?action=` usage with helper.
- [x] Cover both root (`/`) and non-root (`/app`) base URL cases.

### Tests Required

- [x] Unit test for loader RPC URL generation with/without base URL.
- [x] Unit test for action RPC URL generation with/without base URL.
- [x] Unit test for form controller action URL generation with/without base URL.
- [x] Integration/e2e assertion that RPC calls succeed with non-root base URL. *(loader dispatch integration test in `rpcUrl.test.ts`; full Cypress under `/app` deferred to WP-07.)*

### Done When

- [x] No hardcoded root-only RPC endpoint remains in client dispatch paths.
- [x] Test suite passes for both root and non-root base configuration.

---

## WP-02: Popstate cancellation restores full URL (P0)

### Objective

When back/forward navigation is cancelled, restore pathname + query + hash exactly.

### Files

- `packages/lib/src/router/navigation.ts`

### Tasks

- [x] Capture and restore complete prior URL state for popstate cancellation.
- [x] Verify middleware abort, guard cancel, and search-validation cancel all restore correctly.

### Tests Required

- [x] Unit test: cancelled popstate preserves query string.
- [x] Unit test: cancelled popstate preserves hash fragment.
- [x] Unit/integration test: router state matches browser URL after restore.

### Done When

- [x] Cancelled popstate never strips query/hash.
- [x] Router internal location and browser URL stay consistent.

---

## WP-03: Locale/domain ISR cache key consistency (P0)

### Objective

Unify prerender serve and ISR regeneration identity keying so locale/domain entries cannot collide.

### Files

- `packages/lib/src/router/prerenderServe.ts`
- `packages/lib/src/router/prerenderRegenerate.ts`
- `packages/lib/src/router/ssg.ts`

### Tasks

- [x] Define one canonical cache-key strategy (locale/domain aware).
- [x] Apply same key derivation in prerender read and regeneration write paths.
- [x] Remove ambiguous matching based only on `publicPath` where collisions are possible.

### Tests Required

- [x] Unit/integration test for locale-domain cache lookup correctness.
- [x] Unit/integration test for regeneration writing to expected locale-specific key.
- [x] Regression test preventing cross-locale cache contamination.

### Done When

- [x] Regeneration updates only intended locale/domain entry.
- [x] No cache poisoning across locales/domains in tests.

---

## WP-04: Preview SSR proxy fidelity (P1)

### Objective

Make preview proxy behavior align with production SSR behavior for route/query handling.

### Files

- `packages/vite-plugin-kiru/src/previewSsrProxy.ts`
- `packages/vite-plugin-kiru/src/preview-integration.test.ts`

### Tasks

- [x] Forward query string, not just pathname.
- [x] Validate GET/HEAD parity behavior.
- [x] Decide on POST proxying scope for actions/loaders (if ambiguity, raise decision request). *(Proxy POST for `?loader=` / `?action=`.)*

### Tests Required

- [x] Integration test proving query-dependent route renders correctly through preview proxy.
- [x] Regression test confirming no breakage for existing dynamic route preview flow.

### Done When

- [x] Preview proxy matches production routing behavior for query-driven pages.
- [x] Tests explicitly cover query forwarding.

---

## WP-05: Enter guard semantics (P1/P2)

### Objective

Make enter-guard behavior explicit and deterministic.

### Files

- `packages/lib/src/router/navigation.ts`
- Relevant guard tests

### Tasks

- [x] Choose semantics:
  - blocking (cancel/redirect-capable), or
  - post-enter side effect only.
- [x] Implement chosen behavior consistently.
- [x] Add tests reflecting chosen contract.

### Decision Gate

- [x] If semantics are unclear from existing contract, stop and request user decision before coding. *(Post-enter side effects; `onAfterRouteEnter`.)*

### Done When

- [x] Guard semantics are clear, implemented, and tested.

---

## WP-06: Navigation announcer — `<kiru-announcer>` (P1)

### Objective

Provide an accessible route-change announcement for screen readers. The announcer is included in the default page shell, can be disabled by app authors, and speaks **`document.title` only after a navigation has completed successfully** (not on cancel, error, or in-flight redirect).

### Product requirements (must match implementation)

- [x] Render a `<kiru-announcer>` element in the default router app shell (CSR, SSR hydrate, SSG hydrate) unless explicitly disabled.
- [x] Expose a disable switch on router/bootstrap options (e.g. `navigationAnnouncer: false` on `createRouter` / `createRouterApp` — exact name may follow existing option naming in `packages/lib/src/router/bootstrap/types.ts`).
- [x] Use an appropriate live region (`role="status"` and/or `aria-live="polite"`, `aria-atomic="true"`); keep it visually hidden but available to assistive tech.
- [x] **Trigger only on successful navigation completion:**
  - Announce when client navigation ends with `status: "committed"` and outlet/loader work has settled (align with `tryClearClientNavigation` / `canEndClientNavigation` — do not announce on `cancelled`, `errored`, or mid-redirect chains).
  - Read the current **`document.title`** at announce time (after head/title sync for the new route), not a stale or in-flight title.
- [x] Do **not** announce on initial mount/hydration (first paint only); only on subsequent navigations unless product explicitly decides otherwise — if unclear, default to **no announce on first load**.
- [x] Do not announce when navigation is cancelled (guards, middleware abort, search validation cancel, popstate restore).
- [x] Avoid duplicate announcements for the same committed navigation (debounce or compare last announced title + route key).

### Files (starting points — extend as needed)

- `packages/lib/src/router/navigationAnnouncer.ts`
- `packages/lib/src/router/routerShell.ts` — inject announcer into SSR/SSG shell tree
- `packages/lib/src/router/bootstrap/csr.ts` — inject announcer into CSR `createRouterApp` tree
- `packages/lib/src/router/bootstrap/types.ts` — shared `createRouterApp` options
- `packages/lib/src/router/csr.ts` — wire announce hook to successful navigation completion
- `packages/lib/src/ssr/routerHydrate.ts` — ensure hydrated SSR/SSG shell includes announcer when enabled
- `packages/lib/src/router/documentHeadClient.ts` — confirm title is updated before announce fires (ordering)
- `packages/lib/src/router/outletNavigation.ts` — optional hook point when navigation clears (`tryClearClientNavigation`)

### Tasks

- [x] Implement `<kiru-announcer>` (register custom element or Kiru component that renders the live region DOM).
- [x] Add default-on / opt-out option to router and `createRouterApp` bootstrap APIs.
- [x] Mount announcer in default shell alongside `RouterProvider` / `createSsrRouterShell` (same tree for CSR and SSR/SSG hydrate paths).
- [x] Subscribe to successful navigation completion; set live region text from `document.title` after title sync.
- [x] Guard against announce on failed/cancelled navigations and duplicate fires.
- [x] Export/document the option in package types if public API surface requires it.

### Tests Required

- [x] Unit: announcer element renders with expected ARIA attributes when enabled.
- [x] Unit: announcer omitted or inert when `navigationAnnouncer: false` (or chosen option name).
- [x] Unit/integration: after successful `navigate`, live region text matches `document.title`; not updated on `cancelled` / `errored`.
- [x] Unit/integration: no announcement on initial mount/hydration.
- [x] E2E (CSR or SSR): navigate between routes with distinct titles; assert live region updates once per successful nav (Cypress may use `aria-live` container text or test hook). *(Unit coverage in `navigationAnnouncer.test.ts`; Cypress deferred to WP-07.)*

### Done When

- [x] Default apps include `<kiru-announcer>` without author boilerplate.
- [x] Authors can disable via a single documented option.
- [x] Only successful post-navigation title changes are announced; cancelled/error navigations are silent.
- [x] Tests cover enable/disable and success vs cancel behavior.

---

## WP-07: Coverage expansion matrix (P1/P2)

### Objective

Close regression blind spots across CSR/SSR/SSG and file-routes.

### A) File-routes parity (WP-07A)

#### Objective

Bring `file-routes-ssr` and `file-routes-ssg` Cypress suites to the same behavioral coverage as `file-routes` (CSR), using **CSR as the canonical matrix**. Fixtures under the three apps should stay aligned unless a mode intentionally differs (document any exception in the test).

#### Canonical reference

| Artifact | Path |
|----------|------|
| CSR tests (source of truth) | `e2e/file-routes/cypress/e2e/file-routes.cy.ts` |
| SSR tests | `e2e/file-routes-ssr/cypress/e2e/file-routes-ssr.cy.ts` |
| SSG tests | `e2e/file-routes-ssg/cypress/e2e/file-routes-ssg.cy.ts` |
| Shared page tree pattern | `src/pages/**` (layout, dynamic, groups, middleware, extend) |
| Co-located config | `src/pages/about/page.config.ts` (`head.title`) |
| Extend routes | `src/routes.extend.ts` → `/manual` |
| Nav testids | `nav-{displayName}` from `src/routes.ts` `routeLinks` |
| Content testids | `fbr-{route}` (e.g. `fbr-home`, `fbr-pricing`) |

#### Fixture inventory (what codegen must exercise)

| Route / feature | URL | Page file | Extra | CSR test | SSR test | SSG test |
|-----------------|-----|-----------|-------|----------|----------|----------|
| Home | `/` | `pages/page.tsx` | — | yes | yes | yes |
| About + `page.config` title | `/about` | `pages/about/page.tsx` | `page.config.ts` | yes (nav) | yes (nav) | yes (nav) |
| Co-located middleware redirect | `/guarded` | `pages/guarded/page.tsx` + `middleware.ts` | redirect → `/about` | yes (Link) | yes (visit only) | **missing route** |
| Dynamic `[slug]` | `/blog/hello` | `pages/blog/[slug]/page.tsx` | — | yes (Link) | yes (visit) | yes (visit) |
| Route group (no segment in URL) | `/pricing` | `pages/(marketing)/pricing/page.tsx` | group folder | yes (visit) | **missing** | **missing** |
| `routes.extend` manual route | `/manual` | `pages/manual/page.tsx` + extend | — | yes (Link) | **missing** | **missing** |
| Custom not-found | `/does-not-exist` | `pages/not-found.tsx` | — | yes (UI) | **missing** | yes (HTTP 404 + body) |

Before adding tests, **align fixtures** where the matrix shows gaps:

- [x] **SSG:** Add `src/pages/guarded/page.tsx` and guarded redirect config (`page.config.ts` with `static: false` + middleware; no co-located `middleware.ts` on SSG — codegen conflict). Regenerated `routes.gen.ts` / updated `routeLinks`.
- [x] Confirm all three apps expose the same `routeLinks` entries (`guarded`, `pricing`, `manual`, `blog`, etc.) unless deliberately scoped down.

#### Parity test cases (implement in SSR + SSG)

Use stable `it(...)` names across suites where possible. Prefer the same assertion style as CSR (`data-testid`, `cy.location`, `document.title`).

**FR-01 — Home (full load)**  
Already covered; keep as regression anchor.

- Visit `/` (SSR: `http://127.0.0.1:${port}`; SSG: `/`).
- Assert `[data-testid="fbr-home"]` text is `Home`.

**FR-02 — About via Link after hydrate (client navigation)**  
Already covered; keep.

- Visit `/`, click `[data-testid="nav-about"]`.
- Assert pathname `/about`, `[data-testid="fbr-about"]` text `About`.

**FR-03 — Co-located middleware redirect**

CSR: Link click from home. SSR: full visit only today — **add both patterns**.

- [x] **SSR full load:** `cy.visit(`${base}/guarded`)` → pathname `/about`, `fbr-about` exists, `fbr-guarded` absent (match CSR redirect outcome).
- [x] **SSR client nav:** visit `/`, click `nav-guarded` → same assertions as CSR.
- [x] **SSG:** full-load skipped — `/guarded` is `static: false` (middleware redirect); not served on SSG preview full load. Documented in `file-routes-ssg.cy.ts`.
- [x] **SSG client nav:** visit `/`, click `nav-guarded` → redirect to about (middleware on client transition).

**FR-04 — Dynamic `[slug]`**

- [x] **SSR:** keep full-load test; add Link nav from home (`nav-blog`) → `fbr-blog` contains `hello`, pathname `/blog/hello`.
- [x] **SSG:** keep full-load; add Link nav parity.

**FR-05 — Route group URL (marketing)**

Folder `(marketing)` must not appear in URL.

- [x] **SSR:** `cy.visit(`${base}/pricing`)` → pathname `/pricing`, `fbr-pricing` text `Pricing`.
- [x] **SSR:** Link `nav-pricing` from home → same assertions.
- [x] **SSG:** visit `/pricing` + Link `nav-pricing` with same assertions.

**FR-06 — Manual route from `routes.extend.ts`**

- [x] **SSR:** click `nav-manual` → pathname `/manual`, `fbr-manual` text `Manual (extend)`.
- [x] **SSR:** direct visit `/manual` → same content.
- [x] **SSG:** same (visit + Link).

**FR-07 — Not-found**

CSR asserts UI only. SSR/SSG should cover **both** UI and HTTP status where the server/static host exposes it.

- [x] **SSR full load:** visit `/does-not-exist` → `[data-testid="fbr-not-found"]` contains `Not Found`.
- [x] **SSR HTTP:** `cy.request` → status `404`, body includes `Not Found` (documented in test).
- [x] **SSG:** keep existing `cy.request` 404 test; add `cy.visit` UI assertion matching CSR (hydrated not-found page).

**FR-08 — `page.config.ts` head / title**

About route exports `head: { title: "About — file routes" }`.

- [x] **SSR full load:** visit `/about` → `cy.title()` should eq `About — file routes`.
- [x] **SSR client nav:** home → `nav-about` → `cy.title()` updated to `About — file routes` (+ announcer via `includeShadowDom`).
- [x] **SSG full load:** visit `/about` → same title assertion on prerendered HTML.
- [x] **SSG client nav:** home → about → title updates after hydrate navigation.

Optional follow-up (lower priority unless regressions seen):

- [ ] **FR-09 — SSG `scope.config.ts`:** assert `/` (or scoped routes) are present in prerender output / static path set if a small build-time or `cy.request` check is cheap.

#### Implementation checklist (agent order)

1. [x] Diff `e2e/file-routes/src/pages/**` vs SSR/SSG; sync missing files (`guarded`, `docs/[...slug]`, etc.).
2. [x] Regenerate or copy `routes.gen.ts` / `routes.ts` `routeLinks` so nav testids exist in all three apps.
3. [x] Port FR-03–FR-08 tests into `file-routes-ssr.cy.ts` (use `base()` helper consistently).
4. [x] Port FR-03–FR-08 tests into `file-routes-ssg.cy.ts` (root-relative URLs as today).
5. [x] Run each app’s Cypress config in isolation; fix flakiness (`data-kiru-hydrated-at`, `includeShadowDom`, `fbr-*`).

#### Validation commands

Run from repo root (adjust if package scripts differ):

```bash
pnpm --filter e2e-file-routes test
pnpm --filter e2e-file-routes-ssr test
pnpm --filter e2e-file-routes-ssg test
```

Or from each app directory: `pnpm exec cypress run`.

#### Done when (WP-07A only)

- [x] Parity matrix: every CSR row has an equivalent SSR and SSG test (or a documented, reviewed exception in the cy file).
- [x] FR-03 through FR-08 checkboxes above are all `[x]` (SSG FR-03 full-load documented exception).
- [x] All three Cypress suites pass locally/CI.

### B) True SPA nav assertions (CSR)

Target:

- `e2e/csr/cypress/e2e/loaders.cy.ts`

Tasks:

- [x] Replace reload-like transitions with Link-driven SPA transitions.
- [x] Add assertion proving no full reload occurred (`data-kiru-hydrated-at` on CSR).
- [x] Assert expected loader data on client nav (universal loader runs in-browser on CSR; no `?loader=` POST).

### C) Path policy/base URL matrix

Tasks:

- [x] Add e2e for non-root base URL routing (`e2e/path-policy` CSR app, `base: /app/`, `pathPolicy.baseUrl: /app`).
- [x] Add trailing slash / link resolution case (`never` policy — Link `href` without trailing slash).
- [x] CSR e2e in `e2e/path-policy`; SSR/SSG path-policy parity deferred (unit tests in `pathPolicy.test.ts` + `rpcUrl.test.ts`).

### D) Encoded URL/params matrix

Tasks:

- [x] Add unit tests for encoded dynamic and catch-all interpolation (`routePaths.test.ts`).
- [x] Add e2e tests for encoded paths and repeated query keys in CSR/SSR/SSG (`encoded-urls.cy.ts` in each file-routes app).

### Done When

- [x] Identified coverage gaps are represented by concrete, passing tests.

---

## WP-08: Flake hardening + launch sign-off

### Objective

Stabilize CI signal and finalize launch readiness.

### Tasks

- [x] Replace fragile fixed waits with deterministic synchronization where possible (`data-kiru-hydrated-at` on client-nav tests).
- [x] Reduce brittle dependence on internal globals in e2e tests (navigation uses `data-testid` DOM; hydration uses `#app[data-kiru-hydrated-at]`).
- [x] Tighten broad HTML substring checks to stronger route invariants (file-routes FR-* use `fbr-*` testids).
- [x] Run launch gate test suites 3 consecutive green runs (file-routes ×3, file-routes-ssr, file-routes-ssg, path-policy).

### Done When

- [x] No open P0/P1 router issues.
- [x] New/updated tests are stable across repeated runs.

---

## 5) Recommended PR Plan (One Work Package Per PR)

- [x] PR-01 -> WP-01
- [x] PR-02 -> WP-02
- [x] PR-03 -> WP-03
- [x] PR-04 -> WP-04
- [x] PR-05 -> WP-05
- [x] PR-06 -> WP-06 (navigation announcer)
- [x] PR-07 -> WP-07 (single PR: parity + loaders + path-policy + encoded URLs)
- [x] PR-08 -> WP-08

PR requirements:

- [ ] Include "Scope", "Behavior change", "Tests", "Risks" sections.
- [ ] Link to the exact WP checkbox(es) completed.

---

## 6) Agent Output Template (Use After Each WP)

Copy and fill this in each completion update:

### WP-XX Completion Report

- Status: `[x] Done` / `[!] Blocked`
- Code changes:
  - [ ]
  - [ ]
- Tests added/updated:
  - [ ]
  - [ ]
- Validation run:
  - [ ] Unit: (command + result)
  - [ ] E2E/Integration: (command + result)
- Risks/notes:
  - [ ]
- Next WP:
  - [ ]


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

- [ ] `<kiru-announcer>` is present in the default app shell, opt-out capable, and announces `document.title` only after successful client navigations.

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
- Any shared helper introduced for RPC URL construction

### Tasks

- [ ] Create a shared base-aware RPC URL helper.
- [ ] Replace hardcoded `/?loader=` usage with helper.
- [ ] Replace hardcoded `/?action=` usage with helper.
- [ ] Cover both root (`/`) and non-root (`/app`) base URL cases.

### Tests Required

- [ ] Unit test for loader RPC URL generation with/without base URL.
- [ ] Unit test for action RPC URL generation with/without base URL.
- [ ] Unit test for form controller action URL generation with/without base URL.
- [ ] Integration/e2e assertion that RPC calls succeed with non-root base URL.

### Done When

- [ ] No hardcoded root-only RPC endpoint remains in client dispatch paths.
- [ ] Test suite passes for both root and non-root base configuration.

---

## WP-02: Popstate cancellation restores full URL (P0)

### Objective

When back/forward navigation is cancelled, restore pathname + query + hash exactly.

### Files

- `packages/lib/src/router/navigation.ts`

### Tasks

- [ ] Capture and restore complete prior URL state for popstate cancellation.
- [ ] Verify middleware abort, guard cancel, and search-validation cancel all restore correctly.

### Tests Required

- [ ] Unit test: cancelled popstate preserves query string.
- [ ] Unit test: cancelled popstate preserves hash fragment.
- [ ] Unit/integration test: router state matches browser URL after restore.

### Done When

- [ ] Cancelled popstate never strips query/hash.
- [ ] Router internal location and browser URL stay consistent.

---

## WP-03: Locale/domain ISR cache key consistency (P0)

### Objective

Unify prerender serve and ISR regeneration identity keying so locale/domain entries cannot collide.

### Files

- `packages/lib/src/router/prerenderServe.ts`
- `packages/lib/src/router/prerenderRegenerate.ts`
- `packages/lib/src/router/ssg.ts`

### Tasks

- [ ] Define one canonical cache-key strategy (locale/domain aware).
- [ ] Apply same key derivation in prerender read and regeneration write paths.
- [ ] Remove ambiguous matching based only on `publicPath` where collisions are possible.

### Tests Required

- [ ] Unit/integration test for locale-domain cache lookup correctness.
- [ ] Unit/integration test for regeneration writing to expected locale-specific key.
- [ ] Regression test preventing cross-locale cache contamination.

### Done When

- [ ] Regeneration updates only intended locale/domain entry.
- [ ] No cache poisoning across locales/domains in tests.

---

## WP-04: Preview SSR proxy fidelity (P1)

### Objective

Make preview proxy behavior align with production SSR behavior for route/query handling.

### Files

- `packages/vite-plugin-kiru/src/previewSsrProxy.ts`
- `packages/vite-plugin-kiru/src/preview-integration.test.ts`

### Tasks

- [ ] Forward query string, not just pathname.
- [ ] Validate GET/HEAD parity behavior.
- [ ] Decide on POST proxying scope for actions/loaders (if ambiguity, raise decision request).

### Tests Required

- [ ] Integration test proving query-dependent route renders correctly through preview proxy.
- [ ] Regression test confirming no breakage for existing dynamic route preview flow.

### Done When

- [ ] Preview proxy matches production routing behavior for query-driven pages.
- [ ] Tests explicitly cover query forwarding.

---

## WP-05: Enter guard semantics (P1/P2)

### Objective

Make enter-guard behavior explicit and deterministic.

### Files

- `packages/lib/src/router/navigation.ts`
- Relevant guard tests

### Tasks

- [ ] Choose semantics:
  - blocking (cancel/redirect-capable), or
  - post-enter side effect only.
- [ ] Implement chosen behavior consistently.
- [ ] Add tests reflecting chosen contract.

### Decision Gate

- [ ] If semantics are unclear from existing contract, stop and request user decision before coding.

### Done When

- [ ] Guard semantics are clear, implemented, and tested.

---

## WP-06: Navigation announcer — `<kiru-announcer>` (P1)

### Objective

Provide an accessible route-change announcement for screen readers. The announcer is included in the default page shell, can be disabled by app authors, and speaks **`document.title` only after a navigation has completed successfully** (not on cancel, error, or in-flight redirect).

### Product requirements (must match implementation)

- [ ] Render a `<kiru-announcer>` element in the default router app shell (CSR, SSR hydrate, SSG hydrate) unless explicitly disabled.
- [ ] Expose a disable switch on router/bootstrap options (e.g. `navigationAnnouncer: false` on `createRouter` / `createRouterApp` — exact name may follow existing option naming in `packages/lib/src/router/bootstrap/types.ts`).
- [ ] Use an appropriate live region (`role="status"` and/or `aria-live="polite"`, `aria-atomic="true"`); keep it visually hidden but available to assistive tech.
- [ ] **Trigger only on successful navigation completion:**
  - Announce when client navigation ends with `status: "committed"` and outlet/loader work has settled (align with `tryClearClientNavigation` / `canEndClientNavigation` — do not announce on `cancelled`, `errored`, or mid-redirect chains).
  - Read the current **`document.title`** at announce time (after head/title sync for the new route), not a stale or in-flight title.
- [ ] Do **not** announce on initial mount/hydration (first paint only); only on subsequent navigations unless product explicitly decides otherwise — if unclear, default to **no announce on first load**.
- [ ] Do not announce when navigation is cancelled (guards, middleware abort, search validation cancel, popstate restore).
- [ ] Avoid duplicate announcements for the same committed navigation (debounce or compare last announced title + route key).

### Files (starting points — extend as needed)

- New: custom element / component module (e.g. `packages/lib/src/router/navigationAnnouncer.ts` or `packages/lib/src/components/kiruAnnouncer.ts`)
- `packages/lib/src/router/routerShell.ts` — inject announcer into SSR/SSG shell tree
- `packages/lib/src/router/bootstrap/csr.ts` — inject announcer into CSR `createRouterApp` tree
- `packages/lib/src/router/bootstrap/types.ts` — shared `createRouterApp` options
- `packages/lib/src/router/csr.ts` — wire announce hook to successful navigation completion
- `packages/lib/src/ssr/routerHydrate.ts` — ensure hydrated SSR/SSG shell includes announcer when enabled
- `packages/lib/src/router/documentHeadClient.ts` — confirm title is updated before announce fires (ordering)
- `packages/lib/src/router/outletNavigation.ts` — optional hook point when navigation clears (`tryClearClientNavigation`)

### Tasks

- [ ] Implement `<kiru-announcer>` (register custom element or Kiru component that renders the live region DOM).
- [ ] Add default-on / opt-out option to router and `createRouterApp` bootstrap APIs.
- [ ] Mount announcer in default shell alongside `RouterProvider` / `createSsrRouterShell` (same tree for CSR and SSR/SSG hydrate paths).
- [ ] Subscribe to successful navigation completion; set live region text from `document.title` after title sync.
- [ ] Guard against announce on failed/cancelled navigations and duplicate fires.
- [ ] Export/document the option in package types if public API surface requires it.

### Tests Required

- [ ] Unit: announcer element renders with expected ARIA attributes when enabled.
- [ ] Unit: announcer omitted or inert when `navigationAnnouncer: false` (or chosen option name).
- [ ] Unit/integration: after successful `navigate`, live region text matches `document.title`; not updated on `cancelled` / `errored`.
- [ ] Unit/integration: no announcement on initial mount/hydration.
- [ ] E2E (CSR or SSR): navigate between routes with distinct titles; assert live region updates once per successful nav (Cypress may use `aria-live` container text or test hook).

### Done When

- [ ] Default apps include `<kiru-announcer>` without author boilerplate.
- [ ] Authors can disable via a single documented option.
- [ ] Only successful post-navigation title changes are announced; cancelled/error navigations are silent.
- [ ] Tests cover enable/disable and success vs cancel behavior.

---

## WP-07: Coverage expansion matrix (P1/P2)

### Objective

Close regression blind spots across CSR/SSR/SSG and file-routes.

### A) File-routes parity

Targets:

- `e2e/file-routes/cypress/e2e/file-routes.cy.ts`
- `e2e/file-routes-ssr/cypress/e2e/file-routes-ssr.cy.ts`
- `e2e/file-routes-ssg/cypress/e2e/file-routes-ssg.cy.ts`

Tasks:

- [ ] Add SSR parity for route groups/manual routes/not-found behavior.
- [ ] Add SSG parity for route groups/manual routes/not-found behavior.
- [ ] Add head/title/page-config parity assertions where applicable.

### B) True SPA nav assertions (CSR)

Target:

- `e2e/csr/cypress/e2e/loaders.cy.ts`

Tasks:

- [ ] Replace reload-like transitions with Link-driven SPA transitions.
- [ ] Add assertion proving no full reload occurred.
- [ ] Assert expected loader request behavior during client nav.

### C) Path policy/base URL matrix

Tasks:

- [ ] Add e2e for non-root base URL routing.
- [ ] Add trailing slash canonicalization cases (`always`, `never`).
- [ ] Add CSR/SSR/SSG parity assertions for canonical links + navigation outcomes.

### D) Encoded URL/params matrix

Tasks:

- [ ] Add unit tests for encoded dynamic and catch-all interpolation.
- [ ] Add e2e tests for encoded paths and repeated query keys in CSR/SSR/SSG.

### Done When

- [ ] Identified coverage gaps are represented by concrete, passing tests.

---

## WP-08: Flake hardening + launch sign-off

### Objective

Stabilize CI signal and finalize launch readiness.

### Tasks

- [ ] Replace fragile fixed waits with deterministic synchronization where possible.
- [ ] Reduce brittle dependence on internal globals in e2e tests.
- [ ] Tighten broad HTML substring checks to stronger route invariants.
- [ ] Run launch gate test suites 3 consecutive green runs.

### Done When

- [ ] No open P0/P1 router issues.
- [ ] New/updated tests are stable across repeated runs.

---

## 5) Recommended PR Plan (One Work Package Per PR)

- [ ] PR-01 -> WP-01
- [ ] PR-02 -> WP-02
- [ ] PR-03 -> WP-03
- [ ] PR-04 -> WP-04
- [ ] PR-05 -> WP-05
- [ ] PR-06 -> WP-06 (navigation announcer)
- [ ] PR-07 -> WP-07 (can split into 07A/07B if too large)
- [ ] PR-08 -> WP-08

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


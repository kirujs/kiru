# Sandbox SSR navigation investigation

Running log for sandbox/ssr navigation failures (white flash, dead nav, open-full-page from modal). Golden diagnostics per tour step are captured from the e2e/ssr Threadboard replica (`threadboard-nav-tour.cy.ts`).

## Environment

- **App:** `sandbox/ssr` (dev) and `e2e/ssr` Threadboard replica under `/threadboard/*`
- **Debug flags:** `localStorage['kiru-outlet-debug']=1`, `window.__kiruE2eDiagnostics.snapshot()`
- **Browser:** Chromium (Cypress)

---

## Bug 1 — White flash (home → c/kiru)

### Repro steps

1. Visit `/` (home feed hydrated).
2. Click sidebar link `c/kiru`.
3. Observe brief empty `#app` or layout-only frame before community content appears.

### Root cause (confirmed)

Every client navigation rebuilds the **full** route subtree (root layout + leaf) via `buildClientOutletSubtree` → `buildRoutedSubtree`. Layout `{children}` is inlined at build time — there is no nested `<Outlet />` boundary — so the reconciler tears down and recreates layout DOM on each nav. Manual repro: capture the `c/kiru` sidebar `Link` on `/about`, navigate to `/c/kiru`, and `previousLink !== currentLink`.

**Fix:** stable `key` on layout scope vnodes in `composeLayoutWithChild` plus `leafKey` on the leaf fragment so only the leaf swaps; cross-route pending uses stale-while-revalidate in `SsrClientOutlet` to avoid blank `#app` frames.

### Observations

- Outlet debug shows `load:start` → `children.isPending=true` while `resolveOutletContent` returns `null` because `outletMatchRef` (home) ≠ `committedMatch` (community).
- `render:dom-route-mismatch` may appear when stale bootstrap is discarded mid-nav.
- Refresh on `/c/kiru` does not flash — client-only nav from home exposes the gap.
- Community route uses `serverLoader` + nested `resource`; loader pending toggles amplify the blank window.

### Golden diagnostics (tour step 2 — community)

| Field | Expected |
|-------|----------|
| `location.pathname` | `/threadboard/c/kiru` |
| `router.pathname` | `/threadboard/c/kiru` |
| `router.matchRoutePath` | `/threadboard/c/[slug]` |
| `router.interceptActive` | `false` |
| `dom.community` | `true` |
| `dom.home` | `false` |
| `dom.appNotEmpty` | `true` |
| `settled` | `true` |

---

## Bug 2 — Dead navigations

### Repro steps

1. Visit full post page `/p/[id]` (or `/threadboard/p/p-1` in replica).
2. Navigate home via header link.
3. Click feed post title — modal should open; sometimes home leaf stays mounted with post page DOM or `#app` wipes.

Alternate: rapid modal open/close leaves `#app` empty.

### Observations

- After home nav from post page: `dom.home: true` but `dom.postPage: true` persists (stale outlet subtree).
- Outlet log: `load:commit` via `scope-stale-fallback` with wrong `outletMatchRouteId`.
- Hydrated bootstrap fallback used when `match` changed but `hydrateMatchRef` still pointed at post page.
- Interceptor `register` events re-fire after remount — registrations survive, but outlet commit race is the failure mode.

### Golden diagnostics (tour step — post→home→intercept)

| Field | Expected |
|-------|----------|
| `location.pathname` | `/threadboard/p/p-1` (intercept URL) |
| `router.matchRoutePath` | `/threadboard` |
| `router.interceptActive` | `true` |
| `dom.postModal` | `true` |
| `dom.postPage` | `false` |
| `dom.home` | `true` |

---

## Bug 3 — Open full page from modal

### Repro steps

1. Home → click post (soft intercept, modal open, URL `/p/[id]`).
2. Click **Open full page** (`Link` with `intercept={false}`).
3. Modal closes but full post leaf does not mount; URL may stay at intercept path.

### Observations

- With active intercept: `pathname` = target (`/threadboard/p/id`), `match` = background (`/threadboard`).
- `navigate(..., { intercept: false })` called `dismissIntercept({ skipHistoryBack: true })` **before** `commitLocation`, resetting `pathname`/`match` to background mid-flight.
- Modal closes (intercept cleared via dismiss) but outlet may not commit post leaf — `dom.postPage` stays false, `matchRoutePath` stays `/threadboard`.
- CSR `intercept.cy.ts` hard-nav starts from feed without active modal; SSR in-modal case was untested until replica tour.

### Golden diagnostics (tour step 10 — open full page)

| Field | Expected |
|-------|----------|
| `location.pathname` | `/threadboard/p/p-1` |
| `router.pathname` | `/threadboard/p/p-1` |
| `router.matchRoutePath` | `/threadboard/p/[id]` |
| `router.interceptActive` | `false` |
| `dom.postModal` | `false` |
| `dom.postPage` | `true` |
| `dom.home` | `false` |

---

## History navigation (back/forward)

| Step | Action | Expected |
|------|--------|----------|
| After soft post intercept | `go('back')` | Home URL, modal gone, `interceptActive: false` |
| After back from intercept | `go('forward')` | Modal + intercept URL, home background |
| After community visit | `go('back')` | Home restored |
| After community back | `go('forward')` | Community restored |
| After open full page | `go('back')` | Prior stack entry (home or intercept per history depth) |
| After login intercept | `go('back')` | Home, login modal gone |

Popstate invariants: `location.pathname === router.pathname`; no `render:dom-route-mismatch` after settle.

---

## Confirmed root causes

**Open full page:** Hard navigation (`intercept: false`) while an intercept is active incorrectly called `dismissIntercept({ skipHistoryBack: true })` before `commitLocation`. Dismiss resets `pathname` and `match` to the background route and clears navigation state, so the subsequent commit races the outlet and often leaves the background leaf mounted while the URL shows the target post path. Fix: let `commitLocation` clear intercept atomically — do not dismiss first.

**White flash:** `SsrClientOutlet.resolveOutletContent` nulls `children.value` when `outletMatchRef` lags behind a new `committedMatch` during pending loads, and `staleOutletFallback` refuses to show the previous subtree when the match changed. The outlet renders nothing until the new load completes. Fix: stale-while-revalidate — keep `outletRef` visible while `children.isPending`.

**Dead navigations:** Same outlet class as prior threadboard post→home bug: hydrated bootstrap fallback and stale `outletMatchRef` served the wrong subtree after `match` changed. Partially fixed by clearing bootstrap when match diverges; remaining failures are the pending-null flash path above plus communities sidebar linking to `/threadboard` instead of `/threadboard/c/[slug]` in the e2e replica (fixed in replica).

---

## Fixed by / verified by

| Bug | Fix | Verified by |
|-----|-----|-------------|
| Open full page | `navigation.ts` — skip pre-dismiss on hard commit; `csr.ts` — reset hydrated data on route-id change | `navigationIntercept.test.ts`, tour step 4, `threadboard-sandbox.cy.ts` open-full-page |
| White flash | `ssrClientOutlet.tsx` — same-route pending SWR; `resource.ts` — clear `isPending` on abort | tour step 8 (community), aborted-load no longer clobbers outlet |
| Dead nav | `ssrClientOutlet` evict stale outlet on route change; `forceLoaderReload` on route-id change (match-driven outlet reload); replica sidebar links | tour steps 8–10, sandbox hydrate + modal tests |
| Post→home→intercept | `ssrClientOutlet` evict stale outlet on route change; idempotent interceptor registration; `ScopeInterceptorOutlets` at router shell; `runInterceptorLoad` uses `runWithRemoteAbortSignalAsync` so stale aborted outlet scope does not break intercept load | `threadboard-sandbox.cy.ts` post→home→modal, tour |
| History forward (intercept + full leaf) | `csr.ts` popstate intercept restore by owner+target; reconstruct background from history; sync `isActive` before `interceptState`; popstate skip guard when match stale | `threadboard-sandbox.cy.ts` history, tour forward steps |

### Known flakes (documented, skipped in sandbox)

_None — previously skipped cases above are fixed and covered by sandbox + tour specs._

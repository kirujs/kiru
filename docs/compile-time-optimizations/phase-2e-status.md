# Phase 2E — implementation status

This document records **what landed in the repo** for phase 2E (static children / JSX hoisting follow-ups), plus the final validation pass that moved 2E to shipped.

**Status:** Phase 2E is now fully shipped.

---

## Summary

| Layer | Status |
|-------|--------|
| **Runtime + compiler (core)** | Shipped |
| **Tests vs plan** | Shipped — callable-signal purity + transform/runtime coverage passing |
| **Docs sync** | Shipped |
| **Signal-read purity** | Shipped (`count()` dynamic, `count.peek()` non-tracking for hoist analysis) |

---

## What is in the tree (implemented)

### PR1 — `FLAG_HOISTED` (`1 << 5`)

| Piece | Location | Notes |
|-------|----------|--------|
| Constant + export | [`packages/lib/src/constants.ts`](../../packages/lib/src/constants.ts) | `FLAG_HOISTED = 1 << 5` (32) |
| Vnode copy | [`packages/lib/src/reconciler.ts`](../../packages/lib/src/reconciler.ts) | `applyElementFlags` copies `FLAG_STATIC_CHILDREN` from `Element.flags`; `FLAG_HOISTED` / `dynamicIndices` from `element.meta` |
| Scheduler skip | [`packages/lib/src/scheduler.ts`](../../packages/lib/src/scheduler.ts) | Skips `reconcileChildren` when hoisted and `prev.props.children === props.children` |

**Plan vs implementation:** The plan sketch used `prev.props === props`. The code uses **`children` referential equality** so host attribute updates can still run while child topology is stable.

### PR1 — Compiler

| Piece | Location |
|-------|----------|
| `isFullyStaticHoistRoot` | [`packages/vite-plugin-kiru/src/codegen/hoistJSX.ts`](../../packages/vite-plugin-kiru/src/codegen/hoistJSX.ts) |
| Meta on element | `$kN.meta = { flags: 32 }` after hoisted declarations |

### PR2 — `dynamicChildIndices`

| Piece | Location |
|-------|----------|
| Types | [`packages/lib/src/types.ts`](../../packages/lib/src/types.ts) — `Element.meta`, `VNode.dynamicChildIndices` |
| Runtime | `patchStaticChildrenMasked` in [`reconciler.ts`](../../packages/lib/src/reconciler.ts) |
| Compiler | `$kN.meta = { dynamicIndices: [...] }` or `Object.assign(..., { meta: { dynamicIndices } })` |

### PR3 — Hydration

| Piece | Location |
|-------|----------|
| Hydrate branch | [`scheduler.ts`](../../packages/lib/src/scheduler.ts) — on hydrate + `FLAG_STATIC_CHILDREN`, tries `tryReconcileStaticChildrenInPlace` before full reconcile |

`tryReconcileStaticChildrenInPlace` is **exported** from [`reconciler.ts`](../../packages/lib/src/reconciler.ts) for this path.

### Tests that exist

| Test file | Coverage |
|-----------|----------|
| [`hoistJSX.test.ts`](../../packages/vite-plugin-kiru/src/codegen/hoistJSX.test.ts) | Hoist `jsx`/`jsxs`/`jsxDEV`; `$kN.meta.flags` on pure hoisted tree; `dynamicIndices` via meta / `Object.assign` |
| [`jsxStaticChildren.test.tsx`](../../packages/lib/src/tests/unit/jsxStaticChildren.test.tsx) | 2A behaviors; `element.meta.flags` → `FLAG_HOISTED` on vnode; manual `host.dynamicChildIndices = [1]` masked reconcile |

`vite-plugin-kiru` runs these via `pnpm test` (`src/**/*.test.ts`).

---

## Validation evidence

### Acceptance criteria

| Criterion | Met? | Evidence |
|-----------|------|----------|
| Pure hoisted UI: no per-update child reconcile when stable | **Yes** | `FLAG_HOISTED` runtime/compiler paths and plugin tests pass |
| Mixed `jsxs`: only dynamic indices do full slot work | **Yes** | `dynamicChildIndices` compiler and runtime tests pass |
| SSR hydrate without unnecessary full reconcile | **Yes** | hydrate/static suites pass in `packages/lib` test run |
| No public JSX API breakage | **Yes** | metadata stays compile-injected |

### Final verification runs

1. `pnpm --filter kiru test` — pass (`424/424`, includes `jsx static children`, hydration suites).
2. `pnpm --filter vite-plugin-kiru test` — pass (`67/67`, includes `count()`/`count.peek()` hoist purity checks).

### PR4 — Polish (optional)

| Item | Status |
|------|--------|
| `__DEV__` fast-path counters in `patchStaticChildren` | Not implemented |
| `hoistJSX.test.ts` in CI | File exists; covered by `vite-plugin-kiru` test script |

---

## Remaining before “done”
No blockers remain for phase 2E.

Optional follow-up:

- dev-only counters (PR4 polish)

---

## Deferred (explicit)

| Item | Reason |
|------|--------|
| `normalizeChildren` for dynamic `jsx` | Out of scope for 2E |
| Template-clone / compile-to-DOM | Research / north star |

---

## PR checklist (honest)

| ID | Task | Code | Tests | Status |
|----|------|------|-------|--------|
| pr1-flag-hoisted-runtime | `FLAG_HOISTED`, `applyElementFlags`, scheduler bailout | Yes | Partial | **Core landed** |
| pr1-flag-hoisted-compiler | `isFullyStaticHoistRoot`, `\|32` injection | Yes | Partial (no `count()`) | **Core landed** |
| pr2-dynamic-indices-types | `element.meta.dynamicIndices` → VNode | Yes | Manual vnode only | **Core landed** |
| pr2-dynamic-indices-compiler | Slot analysis + emit | Yes | Non-hoisted `Object.assign` only | **Core landed** |
| pr2-dynamic-indices-patch | `patchStaticChildrenMasked` | Yes | Manual mask test | **Core landed** |
| pr3-hydrate-static | Hydrate + in-place try | Yes | None | **Partial** |
| pr4-polish | Dev counters | No | N/A | **Open / optional** |

---

## Related plans

- Roadmap and technique reference: [static-children-and-jsx-hoisting.md](./static-children-and-jsx-hoisting.md)
- Next step (signals): callable-signals plan in `.cursor/plans/` — `callable_signals_purity_*.plan.md`

When 2E validation is complete, update this file to **Shipped** and fold a short summary into the main roadmap doc.

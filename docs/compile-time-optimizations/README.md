# Compile-time optimizations

This folder documents how Kiru uses **compiler hints** (JSX factories, Vite transforms, and vnode flags) together with **runtime fast paths** in the reconciler and scheduler. The goal is less allocation and less reconciliation work for UI that is static by construction.

**Related v2 docs:**

- [Vite plugin and build pipeline](../v2/13-vite-plugin-and-build-pipeline.md) — where transforms run
- [Client bootstrap and hydration](../v2/09-client-bootstrap-and-hydration.md) — hydrate path affected by phase 2E.3
- [Package exports and import guide](../v2/17-package-exports-and-import-guide.md) — `kiru/jsx-runtime` vs `kiru/jsx-dev-runtime`

---

## Topics

| Doc | Contents |
|-----|----------|
| [Static children and JSX hoisting](./static-children-and-jsx-hoisting.md) | Full roadmap: phases 1–2D, 2E design, research, acceptance criteria |
| [Phase 2E status](./phase-2e-status.md) | Shipped status and verification evidence for static-children/hoisting follow-ups |

---

## Enabling JSX hoisting today

Hoisting is **opt-in** via the Vite plugin:

```typescript
// vite.config.ts
import kiru from "vite-plugin-kiru"

export default defineConfig({
  plugins: [
    kiru({
      experimental: {
        staticHoisting: true,
      },
    }),
  ],
})
```

When enabled, [`prepareJSXHoisting`](../../packages/vite-plugin-kiru/src/codegen/hoistJSX.ts) lifts static `jsx` / `jsxs` / `jsxDEV` / `createElement` subtrees to module-level `const $kN = …` bindings. Production builds use `kiru/jsx-runtime`; development uses `kiru/jsx-dev-runtime` and `jsxDEV` (six-argument dev signature).

Automatic JSX is configured with `jsxImportSource: "kiru"` in the plugin defaults (see v2 build doc).

---

## Source of truth

| Area | Package / path |
|------|----------------|
| JSX factories, element flags | `packages/lib/src/jsx.ts`, `element.ts`, `constants.ts` |
| Reconciler patchers | `packages/lib/src/reconciler.ts` |
| Scheduler / host updates | `packages/lib/src/scheduler.ts` |
| Hoist transform | `packages/vite-plugin-kiru/src/codegen/hoistJSX.ts` |
| Tests | `packages/lib/src/tests/unit/jsxStaticChildren.test.tsx`, `packages/vite-plugin-kiru/src/codegen/hoistJSX.test.ts`, `packages/vite-plugin-kiru/src/codegen/template*.test.ts`, `e2e/compile-opts` (Cypress) |

# Compile-time optimization philosophy

This document is the **compiler constitution** for Kiru’s static-hoisting and template pipeline. Follow it when changing `vite-plugin-kiru` codegen or reconciler fast paths.

## Primary model

> **Static DOM structure is authoritative.** Regions describe mutations against that structure. VNodes represent dynamic runtime ownership boundaries only.

> Compile host UI into cloneable HTML shells; represent all non-static behavior as a small, ordered list of **typed regions** bound at known `<!--#-->` anchors—not as a fully hoisted vnode graph.

Kiru is moving from **vnode tree with template optimizations** → **compiled DOM structure with runtime regions**.

## Rules

1. **One host shell per render root** — When `experimental.staticHoisting` is on, maximize a single `_template` / `createHoledTemplate` shell per component return (e.g. layout `<main>`), not many leaf templates for static `<p>` / `<h1>` tags.
2. **Dynamics = typed regions** — Non-static behavior is region metadata at template anchors or `jsxs` child slots (`conditional`, `text`, `fragment`, `children`, `component`, `node`, `insert`), not extra vnodes for markup that belongs in HTML.
3. **`$kN` hoist tiers** — **Module** hoists: shared chrome, region hole payloads, module-pure subtrees. Hole payloads may appear as `$kN` references in `createHoledTemplate(..., [ … ])` after the hoist pass; runtime mounts them at template anchors via slot fragments. **Setup** hoists: one cached render root per component instance (`const $k0 = …; return () => $k0`). Do not hoist static host markup an ancestor template shell already serializes.
4. **Extend `regions`, not `dynamicIndices`** — Positional slot masks on `jsxs` are retired; mixed static layouts use region metadata on templates or hoisted roots.
5. **Hydrate and clone first** — Runtime changes must preserve or improve template shell reuse (`refreshReusedTemplateHoles`), SSR HTML alignment, and anchor-based hole reconciliation.

## One model, two domains

Both `templateRegions` and `slotRegions` use the same [`CompileRegion`](../../packages/lib/src/compileRegions.ts) type. The **domain** selects ownership, not shape:

| Domain | VNode field | Index | Ownership |
|--------|-------------|-------|-----------|
| Template | `templateRegions` | `anchor` | DOM shell, `<!--#-->`, hydration |
| Slot | `slotRegions` | `slot` | Stable child index in a compiled `jsxs` child array |

Do not duplicate validation, traversal, or debug logic per layer—use shared helpers (`validateRegions`, `regionAt`, `resolve*RegionOp`).

The `slot` index is a **stable child index** in a compiler-built static child array. Positional indexing is foundational for mixed `jsxs` (same as other frameworks internally). Future binding descriptors may generalize beyond child arrays; the index itself is not going away.

## Region kinds: `node` vs `component`

| Kind | Meaning | Reconciliation |
|------|---------|----------------|
| `node` | Intrinsic host element (`jsx("div", …)`) | No lifecycle ownership boundary; DOM subtree owned by parent host/template |
| `component` | Function / class component | Ownership boundary: hooks, effects, render |
| `insert` | Unknown / complex expression | Fallback: full slot or hole reconcile |

`component` is a different reconciliation mode—not “a node with behavior.”

Semantic `kind` describes **what** is bound; update **strategy** (direct text, signal sub, hydrate patch) may split later without renaming kinds.

## Region ownership

| Concern | Owner |
|---------|--------|
| Cloned DOM shell | `TemplateRoot` / template host vnode |
| Hole anchor comments | Template HTML + `templateRegions` |
| Per-hole mounted subtree | `templateHoleHeads[i]` + anchor region ops |
| Mixed `jsxs` static siblings | Parent host + `slotRegions` mask |
| Subscriptions / effects | Component vnodes & inline fns |
| Hydration cursor | `hydrationStack` during anchor ops |
| Fragment boundaries | `fragment` kind + `FLAG_STATIC_CHILDREN` |

Async boundaries, suspense, portals, and streaming extend this matrix—not ad-hoc reconciler branches.

## Transform order

Templates run before vnode hoisting ([`jsxHoistPipeline.ts`](../../packages/vite-plugin-kiru/src/codegen/jsxHoistPipeline.ts)): shells first, then lift region payloads to `$kN`.

## Split shells only at boundaries

Break template extraction at **dynamic** boundaries:

- Component calls with non-static props or non-foldable render (`Link` with `to`, components using setup state)
- Conditionals and logical branches
- Loops / `For` (when supported)
- Reactive text and signal reads
- Slots / outlets (`children`)
- Non-static props (`bind:`, events, refs)

**Static leaf FCs** may be **folded into the parent shell HTML** when the call site has only static props, the component is module-pure, and its render root serializes to a zero-hole intrinsic template (e.g. `<Badge />` → `<span class="badge">OK</span>` inlined in the outer `$t0`). The component may still keep its own `$tN` factory for direct use elsewhere.

Not at every static host sibling.

## JSX hoist tiers (`prepareJSXHoisting`)

| Tier | Placement | When |
|------|-----------|------|
| **Module** | File top after imports / module deps | Subtree uses only module bindings; inline handlers OK if they close over module/setup-allowed refs |
| **Setup** | Before `return () =>` in setup body | Render arrow has no params; root JSX is sole render body; only `renderLocal` forbidden |
| **Inline** | `regionElement(...)` at callsite | Fallback when neither hoist applies |

Inline function props/children block hoisting only when the function body references a forbidden binding (not a blanket ban on arrows).

## Related docs

- [Static children and JSX hoisting](./static-children-and-jsx-hoisting.md) — phased roadmap
- [Phase 2E status](./phase-2e-status.md) — shipped vnode-hoist metadata
- [README](./README.md) — enabling `staticHoisting`

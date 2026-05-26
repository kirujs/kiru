# Compile-time optimization philosophy

This document is the **compiler constitution** for Kiru’s static-hoisting and template pipeline. Follow it when changing `vite-plugin-kiru` codegen or reconciler fast paths.

## Primary model

> Compile host UI into cloneable HTML shells; represent all non-static behavior as a small, ordered list of **typed regions** bound at known `<!--#-->` anchors—not as a fully hoisted vnode graph.

## Rules

1. **One host shell per render root** — When `experimental.staticHoisting` is on, maximize a single `_template` / `createHoledTemplate` shell per component return (e.g. layout `<main>`), not many leaf templates for static `<p>` / `<h1>` tags.
2. **Dynamics = typed regions** — Non-static behavior is `meta.regions[]` at template anchors (`conditional`, `text`, `fragment`, `children`, `component`, `insert`), not extra vnodes for markup that belongs in HTML.
3. **`$kN` only for region payloads** — Module hoists hold component lists, pure chrome inside holes, or subtrees templates cannot inline. Do not hoist static host elements that an ancestor shell already serializes.
4. **Extend `regions`, not `dynamicIndices`** — Positional slot masks on `jsxs` are retired; mixed static layouts use region metadata on templates or hoisted roots.
5. **Hydrate and clone first** — Runtime changes must preserve or improve template shell reuse (`refreshReusedTemplateHoles`), SSR HTML alignment, and anchor-based hole reconciliation.

## Transform order

Templates run before vnode hoisting ([`jsxHoistPipeline.ts`](../../packages/vite-plugin-kiru/src/codegen/jsxHoistPipeline.ts)): shells first, then lift region payloads to `$kN`.

## Split shells only at boundaries

Break template extraction at:

- Component boundaries (`Link`, FCs)
- Conditionals and logical branches
- Loops / `For` (when supported)
- Reactive text and signal reads
- Slots / outlets (`children`)
- Non-static props (`bind:`, events, refs)

Not at every static host sibling.

## Related docs

- [Static children and JSX hoisting](./static-children-and-jsx-hoisting.md) — phased roadmap
- [Phase 2E status](./phase-2e-status.md) — shipped vnode-hoist metadata
- [README](./README.md) — enabling `staticHoisting`

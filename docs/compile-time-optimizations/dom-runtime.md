# DOM runtime (`kiru/dom`)

Parallel client stack for **VDOM-less** Kiru apps: compiled or hand-written imperative UI that clones HTML templates, binds signals with `domEffect`, and tears down via an **owner graph** instead of vnodes and the reconciler.

The existing [`kiru`](../packages/lib) entry (`mount`, `jsx`, reconciler) is unchanged.

---

## When to use which stack

| | `kiru` (VDOM) | `kiru/dom` |
|---|---------------|------------|
| Authoring | JSX + components | TSX with `"use dom"` pragma (compiler) or hand-written imperative fixtures |
| Runtime | VNode tree + reconciler | Template clone + direct DOM bindings |
| Mount | `mount(<App />, container)` from `kiru` | `mount(() => <App />, container)` from `kiru/dom` (callback compiled to imperative root) |
| Ownership | `node.current` (VNode) | `owner.current` (Owner) |
| SSR / hydrate | Supported | Not yet (CSR-only) |

---

## Owner graph

Each app and component instance gets an **`Owner`** node:

- **`runWithOwner`** sets `owner.current` during setup (like `node.current` during VDOM render).
- **`domEffect`** and **`on`** register cleanups on the current owner.
- **`disposeOwner`** walks children depth-first, runs all cleanups (effects, listeners), and detaches from the parent.

Implementation: [`packages/lib/src/domRuntime/owner.ts`](../packages/lib/src/domRuntime/owner.ts).

> **Note:** Source lives under `domRuntime/` because `packages/lib/src/dom/` is reserved for low-level VDOM DOM helpers (`createDom`, `commitWork`, etc.). The public export is still **`kiru/dom`**.

---

## Components (`ComponentHandle`)

[`createComponent`](../../packages/lib/src/domRuntime/component.ts) runs a component body under a **child owner** and returns a handle:

```ts
interface ComponentHandle {
  readonly owner: Owner
  getRoot(): Element
  dispose(): void  // remove DOM + disposeOwner
}
```

`dispose()` is idempotent. Use for nested components and keyed list rows.

Reusable factory example: [`e2e/dom/src/apps/counter.ts`](../../e2e/dom/src/apps/counter.ts) — `createCounter(props)` returns `ComponentHandle`.

### Install once, patch on update

On first mount the compiler (or your setup code) **installs** the template once: `clone` → `project` → `insertText` / `on` / `domShow` / child `createComponent` factories. That work runs in the outer setup scope for `() => (props) => jsx`, or once in the `(props) =>` scope for `(props) => () => jsx`.

On **`updateProps`** (and keyed `For` row reuse), the runtime:

1. **`syncProps`** — updates `currentProps`, re-runs `setupDom().derive()` selectors, and re-runs install bindings that read props (via `setupDom().props` in emitted code).
2. **`patchTemplate`** — re-invokes the render thunk; if the returned mount root(s) are unchanged, **no repaint** (no second clone). If the root shape changes (e.g. conditional mount), it repaints.

Do **not** rely on the render `props` parameter for live template text after install — that closure is from the first render. Use **`setupDom().derive()`** for prop-derived reactive state, and let the compiler emit **`setupDom().props.*`** for install-time `insertText` / attribute getters.

### Allowed component shapes

| Shape | Example | Install runs |
|-------|---------|--------------|
| A | `(props) => jsx` | Once (cached return) |
| B | `(props) => () => jsx` | Once in `(props) =>` before inner thunk |
| C | `() => (props) => jsx` | Once in outer `()` (`runSetup`) |
| D | `(initial) => (props) => jsx` | Same as C after initial call |

**Not supported:** `() => (props) => () => jsx` (triple nest).

### `setupDom()`, render `props`, and local `signal`

- **`setupDom().derive(selector)`** — declare prop-derived signals in outer setup (not `computed()` in the render body).
- **Render `props`** — pass to children (`task={props.task}`), wire events when appropriate.
- **`signal()` in outer setup** — local UI state (counters, note counts) that must survive `updateProps` without reparenting.
- **`setupDom().props`** (emitted install getters) — live reads for template bindings; author code should call `setupDom()` in setup for `derive` anyway.

### Conditional mount (`domShow` / `&&`)

Use `domShow` or `condition && <Component />` so panels mount and unmount at template anchors. Do not hide with CSS alone when the goal is to avoid work or preserve correct `For` / component lifetimes.

### Keyed `For` and cross-list state

Keyed [`For`](../../packages/lib/src/domRuntime/for.ts) calls **`updateProps`** on reused row components when the item object changes but the key is stable. **Local `signal` state inside a row does not move** when the row is reparented to another `For` (e.g. another section) — only state keyed within the same list instance is preserved.

---

## Regions (conditional / component holes)

Template shells use `<!--#-->` comment anchors. [`project()`](../../packages/lib/src/domRuntime/template.ts) returns `{ nodes, anchors }`.

[`createRegion(anchor)`](../../packages/lib/src/domRuntime/region.ts) mounts content before the anchor; the anchor stays for re-mount:

```ts
const { anchors } = project($shell, root)
const outlet = createRegion(anchors[0]!)

domEffect(() => {
  if (visible()) {
    outlet.mount(createCounter({ initial: 0 }))
    return () => outlet.unmount()
  }
  outlet.unmount()
})
```

**`domShow(when, anchor, factory)`** — sugar over `domEffect` + `createRegion`.

DOM insertion helpers: [`insert.ts`](../../packages/lib/src/domRuntime/insert.ts) — `mountBefore`, `mountAfter`, `resolveRoot`.

---

## Keyed lists (`For`)

Author TSX uses **`For` from `kiru/dom`** — a runtime component that owns keyed reconciliation. The compiler emits:

```ts
createComponent(For, { each, key?, fallback, children }, $n0.anchors[i])
```

The **anchor** (template `<!--#-->`) is the third argument to `createComponent`, not an author prop. Rows mount before the anchor; static siblings before/after are untouched.

Optional **`key`** on `<For>` is passed through in emit (jsxDEV passes it as the factory’s third argument). When omitted, runtime uses **referential identity** (`WeakMap` per object reference). Use `<For key={(item) => item.id}>` when updates replace item objects (immutable `.map`). Row `key={…}` on intrinsics is ignored by dom template serialization and is not hoisted onto `For`.

```tsx
<ul data-testid="todo-list">
  <For each={items} key={(item) => item.id}>
    {(item) => (
      <li className="todo-row">{item.text}</li>
    )}
  </For>
</ul>
```

Hand fixtures use the same API — `createComponent(For, props, anchor)` with a `<!--#-->` anchor inside the list host:

```ts
createComponent(
  For,
  {
    each: items,
    key: (item) => item.id,
    children: (item) => createComponent(() => { … return rowEl }, {}),
  },
  $n0.anchors[i]
)
```

Implementation lives in [`for.ts`](../../packages/lib/src/domRuntime/for.ts) (LIS reorder via [`lis.ts`](../../packages/lib/src/domRuntime/lis.ts)):

- Removes keys no longer in the array (disposes component handles).
- Creates new keys via `children`.
- Reorders DOM nodes with **LIS** for minimal moves.

### Fragments and multi-root mount content

JSX **fragments** in `children`, `render`, or any other function prop compiled via `compileJsxFnProp` lower to **`DomMountContent`**:

| Fragment | Emitted / runtime |
| -------- | ----------------- |
| `<></>` | No DOM nodes |
| `<><a /></>` | Single root (unwrapped) |
| `<><a /><b /></>` | `[a, b]` before the list anchor |

The compiler detects **function props with a JSX body** by shape (`isJsxFnPropValue`), not by prop name. Multiple roots for one keyed item move together during LIS reorder.

Multi-root `For` children are exercised in [`e2e/dom/src/apps-tsx/keyed-list.tsx`](../../e2e/dom/src/apps-tsx/keyed-list.tsx) (`list-spacer` + `list-item` fragment per key); see [`e2e/dom/cypress/e2e/keyed-list-tsx.cy.ts`](../../e2e/dom/cypress/e2e/keyed-list-tsx.cy.ts). Single-root lists: [`e2e/dom/src/apps/todo.ts`](../../e2e/dom/src/apps/todo.ts) (hand) and [`e2e/dom/src/apps-tsx/todo.tsx`](../../e2e/dom/src/apps-tsx/todo.tsx).

Reactive text on a single-element template shell (e.g. `<p>{item.id}</p>` with no nested structure) binds to the cloned root element when `project().nodes` is empty — the compiler emits `insertText($elN, …)` instead of `$nN.nodes[0]`.

### Reactive text (`insertText`)

Compiler emits `insertText(el, () => expr)` instead of raw `domEffect` + `textContent` for signal text bindings:

```ts
insertText($n0.nodes[1], () => count())
```

---

## `"use dom"` compiler (shipped in e2e/dom)

Author TSX with a file-level pragma (like `"use client"`). The compiler transforms component bodies and `mount` callbacks — **`createComponent` is emitted by the plugin, not written in author code.**

### Mount entry

Single callback shape; the first argument is always transformed before runtime:

```tsx
"use dom"

import { mount } from "kiru/dom"

// Root via component
export function mountCounter(container: HTMLElement) {
  return mount(() => <Counter />, container)
}

// Inline setup (no separate component required)
export function mountInline(container: HTMLElement) {
  return mount(() => {
    const count = signal(0)
    return () => (
      <button onclick={() => count.set((c) => c + 1)}>Count: {count()}</button>
    )
  }, container)
}
```

### Components and holes

Define reusable components as functions that return a render arrow (or let the compiler flatten a direct JSX return). Nest them with JSX tags only:

```tsx
function ToggleApp() {
  const visible = signal(false)
  return () => (
    <div>
      <button onclick={() => visible.set((v) => !v)}>Toggle</button>
      {visible() && <Counter testId="child-counter" />}
    </div>
  )
}
```

Do **not** import or call `createComponent` in author TSX — use `<Comp props />` in trees and `mount(() => <App />, container)` at the root.

**Compiler emit for component holes** (including `<For>` and nested components like `<Counter />`):

```ts
createComponent(Fn, compiledProps, $n0.anchors[i])
```

The anchor is always the third argument. Regular components are auto-mounted before the anchor by runtime `createComponent`; anchored components such as `For` receive the anchor as their second parameter and manage bounded list insertion internally. `compileComponentProps` lowers JSX in props (`fallback`, row `children`) to imperative setup; plain prop objects are passed through unchanged.

`mountBefore` remains a runtime primitive for hand fixtures and regions — dom-codegen does not emit it for component holes.

Example component body:

```tsx
"use dom"

import { signal, mount } from "kiru/dom"

function Counter(props: { initial?: number }) {
  const count = signal(props.initial ?? 0)
  return () => (
    <div class="counter-item">
      <span class="counter-value">{count()}</span>
      <button onclick={() => count.set((c) => c + 1)}>+</button>
    </div>
  )
}
```

Enable in Vite:

```ts
import kiru from "vite-plugin-kiru"

export default defineConfig({
  plugins: [kiru({ experimental: { domCodegen: true } })],
})
```

**Per-file routing:** only files whose first top-level statement is `"use dom"` enter the dom pipeline. The pragma is stripped from emitted JS. Other files keep the existing jsx-hoist / VDOM path.

**Emit quality:** the compiler targets correct `kiru/dom` semantics (owner cleanup, keyed reuse, bind sync). It is **not** required to match hand-emitted `$t0` / node-index comments byte-for-byte — hand apps remain behavioral fixtures; the compiler may emit cleaner imperative code when JSX allows it.

Implementation: [`packages/vite-plugin-kiru/src/codegen/dom/`](../../packages/vite-plugin-kiru/src/codegen/dom/).

---

## Hand-written app convention (reference fixtures)

E2e apps under [`e2e/dom/src/apps`](../../e2e/dom/src/apps) **manually emit** imperative code. Each file documents author JSX in a comment block at the top, then the emitted `$tN` / `project` / `domEffect` body below.

Parallel **author TSX** apps live in [`e2e/dom/src/apps-tsx`](../../e2e/dom/src/apps-tsx) with `"use dom"` — the plugin compiles them to imperative `kiru/dom` emit. Divergence from hand fixtures is expected and fine as long as Cypress parity holds.

```ts
/*
 * ── Source (author JSX) ─────────────────────────────────────
 * … commented JSX the author would write …
 * ── Compiler output (emitted) ───────────────────────────────
 */

const $t0 = template(`…`)
const $el0 = clone($t0)
const $n0 = project($t0, $el0)
bindValue($n0.nodes[1] as HTMLInputElement, draft)
on($n0.nodes[0], "submit", addTodo)
```

**Rules for emitted code:**

- **No `querySelector`** — only `$n = project($t, $el)` and `$n.nodes[i]` / `$n.anchors[i]`. Inline comments document indices (e.g. `// nodes[0]=form, [1]=input`).
- **No reading form control state in handlers** — use signals + `bindValue` / `bindChecked` (`bind:*` in JSX).
- **Module templates** as `$t0`, `$t1`, …; cloned roots `$el0`; projections `$n0`.
- **Components** via `createComponent` in emitted output (author TSX uses `<Comp />`; hand apps use factories like `createCounter`).
- **Lists** via `<For />` (compiler and hand fixtures); **conditionals** via `domShow` / `createRegion` + `domEffect` (or `For` `fallback`).
- **`data-testid`** stays in template HTML only (for Cypress), never used for binding lookup.
- Non-signal field paths (e.g. `item.done` in a keyed row) emit **`domEffect` + `on`** with closure — documented in the JSX comment block.

Use compile-time **`structuralWalk`** / **`nodeIndex`** when emitting from the compiler; hand-written apps use `project()` which derives the walk from HTML.

---

## Signal bindings (`bindValue`, `bindChecked`)

Two-way bindings mirror VDOM `bind:*` props without vnodes. Implementation: shared [`bindElementSignal`](../../packages/lib/src/dom/bindSignal.ts); owner-scoped wrappers in [`domRuntime/bind.ts`](../../packages/lib/src/domRuntime/bind.ts).

| Export | JSX | Behavior |
|--------|-----|----------|
| `bindValue(el, signal)` | `bind:value={sig}` | input/textarea/select value sync; `input`/`change` listeners; owner cleanup |
| `bindChecked(el, signal)` | `bind:checked={sig}` | checkbox/radio checked sync |
| `bindProp(el, attr, signal)` | generic `bind:*` | thin wrapper for future attrs |

```ts
const draft = signal("")
bindValue($n0.nodes[1] as HTMLInputElement, draft)

function addTodo() {
  const text = draft().trim()
  if (!text) return
  items.set([...items(), { id: nextId++, text, done: false }])
  draft.set("")
}
```

Cleanups register on the current owner via `registerOwnerCleanup` — bindings stop syncing after `unmount()` / `dispose()`.

---

## Public API (`kiru/dom`)

| Export | Role |
|--------|------|
| `mount` / `DomAppHandle` | Root app lifecycle |
| `template`, `clone`, `project` | Template shells + DOM projection |
| `insertText` | Reactive text binding sugar over `domEffect` |
| `For` | Keyed list component — compiler emits `createComponent(For, props, anchor)` |
| `domEffect` | Owner-scoped reactive bindings |
| `on`, `setText`, `setProp` | DOM bindings |
| `bindValue`, `bindChecked`, `bindProp` | Two-way signal ↔ DOM bindings |
| `createComponent`, `ComponentHandle` | Child owner + `dispose()` — **compiler-emitted** as `createComponent(Fn, props, anchor?)` from template holes, `<For />`, and `mount(() => <App />, …)`; hand fixtures import explicitly |
| `createRegion`, `domShow` | Conditional / component holes |
| `mountBefore`, `mountAfter` | DOM insertion |
| `createOwner`, `runWithOwner`, `disposeOwner`, … | Owner graph |
| `signal`, `computed` | Re-exported from core signals |

---

## E2E sandbox

[`e2e/dom`](../../e2e/dom) — Vite + `vite-plugin-kiru` (`experimental.domCodegen: true`) + Cypress.

Query-param routing:

- Hand fixtures: `?app=counter|toggle|nested|swap|todo|keyed-list|inbox` (default `counter`)
- Compiler TSX: `?app=counter-tsx|toggle-tsx|nested-tsx|swap-tsx|todo-tsx|keyed-list-tsx|inbox-tsx|workspace-tsx`

| Route | Hand fixture | TSX (`apps-tsx/`) | Proves |
|-------|--------------|-------------------|--------|
| counter | `counter.ts` | `counter.tsx` | Flat template + signals |
| toggle | `toggle.ts` | `toggle.tsx` | `domShow` teardown; fresh instance on re-show |
| nested | `nested.ts` | `nested.tsx` | Parent `domEffect` + child `createCounter` in region |
| swap | `swap.ts` | `swap.tsx` | Reactive region swaps component types |
| todo | `todo.ts` | `todo.tsx` | `bindValue`, `For` add/delete/done |
| keyed-list | `keyed-list.ts` | `keyed-list.tsx` | Keyed reorder preserves component state |
| inbox | `inbox.ts` | `inbox.tsx` | Filters, computed list, `For` fallback empty state |
| — | — | `workspace.tsx` | **TSX-only stress:** nested `For`, fragment rows, computed filter, expand/collapse + inner list, section/task reorder, cross-section moves, nested `For` fallback |

Cypress mirrors every hand spec with a `-tsx` spec (same assertions, `-tsx` route). `workspace-tsx` has no hand mirror.

Port: **5179** (dev), **8019** (hmr) — [`e2e/shared/ports.mjs`](../../e2e/shared/ports.mjs)  
Builderman: **`e2e:dom`**

```bash
cd e2e/dom && pnpm dev
cd e2e/dom && pnpm test
```

---

## Roadmap

1. **Shipped:** Owner graph, `mount`, templates, Counter, components, regions, `For`, lifecycle e2e apps.
2. **Shipped (e2e/dom):** `experimental.domCodegen` — `"use dom"` TSX → imperative emit; `apps-tsx/` + `-tsx` Cypress parity.
3. **Later:** Owner-aware signal entangle; SSR/hydrate sharing `structuralWalk`.

---

## Related docs

- [Compile-time philosophy](./PHILOSOPHY.md)
- [Static children & templates roadmap](./static-children-and-jsx-hoisting.md)
- [Testing strategy](../v2/15-testing.md)

# ADR: Parallel and intercepting routes (programmatic API)

**Status:** Accepted for v2.1 direction — **not shipped in v2.0**  
**Sprint:** S5 (P3-4)  
**Related:** [04-route-tree-and-matching.md](./04-route-tree-and-matching.md), [09-client-bootstrap-and-hydration.md](./09-client-bootstrap-and-hydration.md)

---

## Context

Kiru v2 matches **one leaf route per URL** today. Layouts nest via scopes and `{ children }` only (`loadRouteTree`, `buildRoutedSubtree`). There is no named outlet or parallel segment.

Teams expect **parallel routes** (dashboard + sidebar + main at the same URL) and **intercepting routes** (photo modal over a list on client nav). Next.js uses `@folder` and `(.)` conventions; this ADR chooses a **programmatic** API on `createRouteScope` / `createRoute` so the same tree powers CSR, SSR, SSG, and sitemap without filesystem magic in v2.0.

File-based sugar (`@sidebar/` folders) may map onto this tree in a later release.

---

## Decision summary

| Capability | v2.0 | v2.1 | v2.1b |
|------------|------|------|-------|
| Named parallel **slots** on scopes | ADR only | **Implement** | — |
| **Intercepting** (soft/hard) | ADR only | — | **Implement** |
| Next-style `@slot` file folders | — | Optional codegen sugar | — |

**Chosen approach:** **Option A — scope `slots` + layout `slots` prop** (see below). Reject Remix `<Outlet name="…" />` and Next `@folder` as the primary v2.1 authoring model.

---

## Goals

1. One `RouteManifest` for all modes (unchanged architecture goal).
2. Author in `routes.ts` or codegen — no required `@` directory names.
3. Phased delivery: slots first (match + render + loaders); intercepting second (navigation state).
4. CSR/SSR/SSG parity for slot loader refetch and error outlets (extend S2 parity matrix when implementing).

---

## Non-goals (v2.0)

- Shipping parallel or intercepting behavior.
- File-routes `@modal` scanning.
- Changing `matchRoute` scoring for unrelated routes.

---

## API sketch (v2.1)

### 1. Named slots on scopes

```typescript
import { createRoute, createRouteScope, createRouteTree } from "kiru/router"

const dashboard = createRouteScope({
  id: "dashboard",
  layout: () => import("./dashboard-layout"),
  defaultSlot: "main",
  slots: {
    sidebar: createRouteTree({
      children: [
        createRoute("/settings", { component: () => import("./settings") }),
      ],
    }),
    main: createRouteTree({
      children: [
        createRoute("/dashboard", { component: () => import("./home") }),
      ],
    }),
  },
  children: [
    // Routes here attach to defaultSlot ("main") unless slot: "sidebar" is set
    createRoute("/reports", { component: () => import("./reports") }),
  ],
})
```

**Per-route slot override (optional):**

```typescript
createRoute("/settings", {
  slot: "sidebar",
  component: () => import("./settings"),
})
```

### 2. Default slot rule (resolved)

**Decision:** Child routes under a scope **without** `slot:` attach to `defaultSlot` (default `"main"` if the scope defines `slots`). Explicit `slot:` is required only when attaching to a non-default slot. This matches Next’s “default parallel segment” ergonomics without forcing `slot: "main"` on every leaf.

### 3. Layout contract (breaking in v2.1)

Layouts that declare `slots` on the scope receive:

```typescript
type LayoutProps = {
  children: JSX.Element // default slot subtree (backward compatible)
  slots: Record<string, JSX.Element> // all active slot subtrees
}
```

Scopes **without** `slots` keep today’s `{ children }` only.

### 4. Match and manifest

Extend compilation:

- Each slot is a **sub-manifest** (compiled subtree).
- `matchRoute(manifest, pathname)` returns:

```typescript
type RouteMatch = {
  route: CompiledRoute       // primary leaf (URL owner)
  params: Record<string, string>
  pathname: string
  activeSlots: Record<string, SlotMatch>
}

type SlotMatch = {
  route: CompiledRoute
  params: Record<string, string>
}
```

**URL ownership (resolved):** All active slots share the **same pathname** for a request (Next-style). Slots do not get independent URL segments in v2.1; secondary pathnames per slot are out of scope (would require multiple `matchRoute` passes and break typed `Link`).

`matchRoute` algorithm (sketch):

1. Match primary leaf as today (highest score).
2. Walk ancestor scopes; for each scope with `slots`, run `matchRoute` on each slot sub-manifest with the **same** pathname.
3. Inactive slots render `null` or a scope-level `slotFallback` (TBD in implementation PR).

### 5. Rendering pipeline

| Step | Change |
|------|--------|
| `loadRouteTree` | → `loadRouteTreeWithSlots`: parallel `import()` for primary + each active slot leaf and layouts |
| `buildRoutedSubtree` | Innermost layout with slots receives `{ children, slots }` |
| `prepareAppForUrl` | Prepare loader/head per slot where slot has `serverLoader` |
| `buildClientOutletSubtree` | Re-run slot loaders on navigate; same `loaderEpoch` / invalidate rules |
| SSG prerender | One HTML document includes all active slot HTML |

### 6. Intercepting (v2.1b — deferred)

Declarative on the **target** route, not filesystem `(.)`:

```typescript
createRoute("/photo/[id]", {
  component: () => import("./photo-page"),
  intercept: {
    from: "/photos",
    mode: "soft",
    render: () => import("./photo-modal"),
    slot: "modal",
  },
})
```

Requires parent scope with `slots.modal`.

| Mode | URL bar | History | SSR first paint |
|------|---------|---------|-----------------|
| `soft` | **Decision:** pathname updates to target (`/photo/1`) while list layout stays mounted in `main` slot; modal in `modal` slot (share URL, dual presentation) | `pushState` + router `presentation` state | Full page on hard reload; soft only after hydrate |
| `hard` | Target URL | Normal | Normal SSR |

**Rejected for soft intercept:** Keeping pathname on `/photos` while showing `/photo/1` UI without URL change — hurts shareability, breaks SSR, and diverges from App Router mental model. Implementation must still solve “back closes modal” via history + slot teardown.

Router state additions (v2.1b): `interceptStack` or `presentation: "page" | "modal"` in `navigation.ts` / `createRouter`.

---

## Alternatives considered

| Option | Verdict |
|--------|---------|
| **A. Scope `slots` + layout props** | **Chosen** — fits scope/layout model; programmatic; testable |
| **B. Remix `<Outlet name="modal" />`** | Rejected — new runtime component and JSX contract |
| **C. Route meta only `parallel: { modal: loader }`** | Rejected — layout composition unclear |
| **D. Next `@folder` conventions** | Deferred as optional file-routes sugar only |

---

## Implementation impact (estimate)

- `packages/lib/src/router/types.ts` — scope/slot types
- `packages/lib/src/router/manifest.ts` — compile slot subtrees
- `packages/lib/src/router/routeTree.ts`, `clientRoutePrep.ts`, `navigation.ts`
- `packages/file-routes` — later: map `@sidebar` → `slots.sidebar`
- Tests: unit `matchRoute` + slots; e2e parity rows

**v2.0 spike (paper):** Two-slot `/dashboard` manifest sketch; list of CSR/SSR parity rows — no public API freeze until v2.1.

---

## File-routes (future sugar)

Not v2.0. Possible mapping:

```
app/
  dashboard/
    layout.tsx
    @sidebar/settings/page.tsx  →  slots.sidebar
    @main/page.tsx             →  slots.main
```

Codegen emits the programmatic `slots` object on `createRouteScope`.

---

## Further reading

- [04-route-tree-and-matching.md](./04-route-tree-and-matching.md)
- [18-release-sprint-todos.md](./18-release-sprint-todos.md) (S5-1)

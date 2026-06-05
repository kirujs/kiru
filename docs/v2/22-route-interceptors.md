# Route interceptors (runtime API)

CSR-only **soft navigation** overlays: the URL updates to a real target route while the source page stays mounted and renders alternate UI. Hard navigation (refresh, direct URL, `intercept: false`) renders the target route normally.

**Related:** [20-parallel-routes-adr.md](./20-parallel-routes-adr.md) (declarative / slot-based intercepting, deferred).

---

## API

Co-export interceptors on **page or layout** modules:

```tsx
import { defineInterceptors, Link } from "kiru/router"
import PhotoModal from "./photo-modal"

export const interceptors = defineInterceptors({
  photo: {
    path: "/photos/[id]",
    load: async ({ params, signal, context }) =>
      fetchPhoto(params.id, { signal, context }),
    render: ({ params, restore, reload, data, error }) =>
      error ? (
        <div>
          <p>{error.message}</p>
          <button type="button" onclick={reload}>
            Retry
          </button>
        </div>
      ) : (
        <PhotoModal photoId={params.id} photo={data} onClose={restore} />
      ),
  },
})

export default function RootLayout({ children }) {
  return (
    <div>
      <main>{children}</main>
      {/* Outlets auto-append after layout output when omitted */}
    </div>
  )
}
```

### Placement rules

| Rule | Detail |
| ---- | ------ |
| **Shared across pages** | Define on a **layout** module (scope owner). |
| **Single page only** | Define on that **page** module (route owner). |
| **Default Outlets** | Unmounted `<interceptors.slot.Outlet />` components are auto-appended after the owner’s rendered output (slot order = object key order). |
| **Manual Outlets** | Mount `<interceptors.slot.Outlet />` to control DOM position; that slot is not auto-appended. |

### `InterceptorHandle`

| Member      | Description |
| ----------- | ----------- |
| `Outlet`    | Renders `null` when inactive; calls `render` when intercept is active. |
| `isActive`  | `true` while this registration’s intercept is showing |
| `isPending` | `true` while interceptor `load` is in flight |
| `restore()` | Dismiss intercept (usually `history.back()`); same as browser back |
| `slot`      | Slot key from `defineInterceptors` |
| `path`      | Target route path pattern |

### Context (`load` / `render`)

- `params` — target route params (typed via `RouteTree` augmentation, same as `Link`)
- `location` — target `pathname` + `params`
- `signal` — navigation abort signal
- `context` — per-request `CustomRequestContext` (same as page loaders)
- `data` / `error` — discriminated union (same shape as page props)
- `restore` — dismiss intercept (render only)
- `reload()` — re-run interceptor `load` without dismissing (render only)

### Navigation

- `router.navigate("/photos/123")` → `{ status: "intercepted" }` when a matching registration exists
- `<Link intercept={false}>` or `router.navigate(url, { intercept: false })` — full navigation

### Prefetch

`<Link prefetch>` prefetches **interceptor `load`** when the link would soft-intercept from the current page.

---

## Owner model

Registration is scoped to **who owns the module**, not whichever leaf was active when an outlet first mounted:

| Owner | Module | Matches navigation from |
| ----- | ------ | ----------------------- |
| `scope` | Layout | Any leaf whose `route.scopes` includes that scope while the layout is mounted |
| `route` | Page | That exact leaf route only |

**Precedence:** route-owned wins over scope-owned when both match the same target.

Example: layout-owned `/photos/[id]` intercepts from home or the photos feed; page-owned `/users/[id]` on `/about` intercepts only from `/about`.

---

## Invariants

1. **Target path** must exist in the route manifest.
2. **URL = target** — shareable; refresh loads the full target page.
3. **Background = source** — `router.match` stays on the page you navigated from; target params are in `render({ params })`.
4. **SSR / first paint** — never intercept; only client navigations after hydrate.
5. **`restore` / back** — dismisses intercept without unmounting the background page.

---

## History

`pushState` stores `kiruIntercept` metadata. Browser back pops to the background URL and clears intercept state without rebuilding the primary outlet.

---

## Typing

Augment `RouteTree` like `Link`:

```ts
declare module "kiru/router" {
  interface RouteTree {
    routes: [typeof photosRoute, typeof photoDetailRoute]
  }
}
```

`defineInterceptors({ slot: { path, load?, render } })` checks `path` against the augmented tree and infers `params` / `data` from the slot definition.

---

## E2E

`e2e/csr` — layout scope (`/photos/[id]` from home + feed), page route (`/users/[id]` from `/about`), `cypress/e2e/intercept.cy.ts`.

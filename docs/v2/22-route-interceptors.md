# Route interceptors (runtime API)

CSR-only **soft navigation** overlays: the URL updates to a real target route while the source page stays mounted and renders alternate UI in a page-local outlet. Hard navigation (refresh, direct URL, `intercept: false`) renders the target route normally.

**Related:** [20-parallel-routes-adr.md](./20-parallel-routes-adr.md) (declarative / slot-based intercepting, deferred).

---

## API

Declare interceptors at module scope and mount each `<name.Outlet />` on the owning page:

```tsx
import { Link, defineRouteInterceptors, routeInterceptor } from "kiru/router"
import PhotoModal from "./photo-modal"

export const interceptors = defineRouteInterceptors({
  photo: routeInterceptor("/photos/[id]", {
    load: async ({ params, signal, context }) =>
      fetchPhoto(params.id, { signal, context }),
    render: ({ params, restore, reload, data, error }) =>
      error ? (
        <div>
          <p>{error.message}</p>
          <button type="button" onClick={reload}>
            Retry
          </button>
        </div>
      ) : (
        <PhotoModal photoId={params.id} photo={data} onClose={restore} />
      ),
  }),
})

export default function PhotosPage() {
  return (
    <>
      <Link to="/photos/[id]" params={{ id: "123" }}>
        Open
      </Link>
      <interceptors.photo.Outlet />
    </>
  )
}
```

### `InterceptorHandle`

| Member      | Description                                                                                                                      |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `Outlet`    | Renders `null` when inactive; calls `render` when intercept is active. Registration runs when `Outlet` mounts (component setup). |
| `isActive`  | `true` while this registration’s intercept is showing                                                                            |
| `isPending` | `true` while interceptor `load` is in flight                                                                                     |
| `restore()` | Dismiss intercept (usually `history.back()`); same as browser back                                                               |

### Context (`load` / `render`)

- `params` — target route params (typed via `RouteTree` augmentation, same as `Link`)
- `location` — target `pathname` + `params`
- `signal` — navigation abort signal
- `context` — per-request `CustomRequestContext` (same as page loaders)
- `data` / `error` — discriminated union (same shape as page props): `{ data: T; error: null }` or `{ data: null; error: Error }`. Thrown `load` errors are caught; `render` runs in both cases.
- `restore` — dismiss intercept (render only)
- `reload()` — re-run interceptor `load` without dismissing (render only); `isPending` is true while reload runs

While `load` is in flight, `error` is `null` and `data` may be `null`; use `isPending` or guard on `data` before rendering success UI.

### Navigation

- `router.navigate("/photos/123")` → `{ status: "intercepted" }` when a matching registration exists
- `<Link intercept={false}>` or `router.navigate(url, { intercept: false })` — full navigation

### Prefetch

`<Link prefetch>` prefetches **interceptor `load`** (not the target route loader) when the link would soft-intercept from the current page. Cached data is consumed on intercept commit so the modal can open without a spinner. Cache and in-flight prefetches for that registration are cleared when the `Outlet` unmounts.

- `prefetch={{ interceptLoad: false }}` — skip interceptor load prefetch
- `prefetch={{ intercept: false }}` — prefetch target route loader instead (same as `intercept={false}` on navigate)

---

## Invariants

1. **Target path** must exist in the route manifest (`CompiledRoute.path`).
2. **URL = target** (`/photos/123`) — shareable; refresh loads the full target page.
3. **Outlet = source** — background `match` stays on the feed; `useParams()` reflects background params; target params are in `render({ params })`.
4. **SSR / first paint** — never intercept; only client navigations after hydrate.
5. **`restore` / back** — dismisses intercept without unmounting the background page.

---

## Matcher

Registration is scoped to `(fromRouteId, targetPath)`:

- `fromRouteId` — current route when the interceptor `Outlet` mounts (override with `from` on the definition)
- `targetPath` — logical pattern from `path` (e.g. `"/photos/[id]"`)

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

Use `routeInterceptor("/photos/[id]", { … })` inside `defineRouteInterceptors` so the path is checked against your augmented `RouteTree`, `params` is inferred from the path pattern, and `data` is inferred from `load`'s return type.

---

## E2E

`e2e/csr` — `/photos` gallery, `cypress/e2e/intercept.cy.ts`.

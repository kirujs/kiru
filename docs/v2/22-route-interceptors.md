# Route interceptors (runtime API)

CSR-only **soft navigation** overlays: the URL updates to a real target route while the source page stays mounted and renders alternate UI in a page-local outlet. Hard navigation (refresh, direct URL, `intercept: false`) renders the target route normally.

**Related:** [20-parallel-routes-adr.md](./20-parallel-routes-adr.md) (declarative / slot-based intercepting, deferred).

---

## API

Register from a page component via `useRouter()`:

```tsx
import { Link, useRouter } from "kiru/router"

export default function PhotosPage() {
  const router = useRouter()
  const photo = router.createInterceptor("/photos/[id]", {
    load: async ({ params, signal }) => fetchPhoto(params.id, { signal }),
    render: ({ params, restore, data }) => (
      <PhotoModal photoId={params.id} photo={data} onClose={restore} />
    ),
  })

  return () => (
    <>
      <Link to="/photos/[id]" params={{ id: "123" }}>Open</Link>
      <photo.Outlet />
    </>
  )
}
```

### `InterceptorHandle`

| Member | Description |
|--------|-------------|
| `Outlet` | Renders `null` when inactive; calls `render` when intercept is active |
| `isActive` | `true` while this registration’s intercept is showing |
| `isPending` | `true` while interceptor `load` is in flight |
| `restore()` | Dismiss intercept (usually `history.back()`); same as browser back |

### Context (`load` / `render`)

- `params` — target route params (typed via `RouteTree` augmentation, same as `Link`)
- `location` — target `pathname` + `params`
- `signal` — navigation abort signal
- `data` — result of interceptor `load` (not the target page’s `export const load`)
- `restore` — render only

### Navigation

- `router.navigate("/photos/123")` → `{ status: "intercepted" }` when a matching registration exists
- `<Link intercept={false}>` or `router.navigate(url, { intercept: false })` — full navigation

### Prefetch

`<Link prefetch>` prefetches **interceptor `load`** (not the target route loader) when the link would soft-intercept from the current page. Cached data is consumed on intercept commit so the modal can open without a spinner.

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

- `fromRouteId` — current route when `createInterceptor` runs (override with `from` in options)
- `targetPath` — logical pattern (e.g. `"/photos/[id]"`)

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

`router.createInterceptor("/photos/[id]", …)` then autocompletes paths and infers `params.id`.

---

## E2E

`e2e/csr` — `/photos` gallery, `cypress/e2e/intercept.cy.ts`.

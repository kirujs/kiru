# Route interceptors

## Overview

Interceptors enable **soft navigation**: the URL updates to a real target route while the source page stays mounted and renders alternate UI — typically a modal, drawer, or lightbox. Hard navigation (refresh, direct URL entry, `intercept: false`) renders the target route normally.

Co-export `interceptors` from a **layout** (shared across pages in a scope) or **page** (single-route only) module via `defineInterceptors`.

---

## How it works

### Soft vs hard navigation

| Trigger | Behavior |
|---------|----------|
| `Link` / `navigate()` to matching path | Soft — `{ status: "intercepted" }` |
| `intercept: false` on Link or navigate | Hard — full route render |
| Browser refresh / direct URL | Hard |
| `history.back()` from intercept | `restore()` dismisses overlay |

### Owner model

| Owner | Defined on | Matches when |
|-------|------------|--------------|
| Scope | Layout module | Navigating from any leaf under that layout |
| Route | Page module | Navigating from that exact leaf only |

When both match the same target, **route-owned wins** over scope-owned.

### Slot definition

Each slot has:

- `path` — target route pattern (typed via `RouteTree`)
- `load?` — optional async data fetch (like a mini-loader)
- `render` — UI when intercept is active

### InterceptorHandle

`defineInterceptors` returns an object of handles:

| Member | Description |
|--------|-------------|
| `Outlet` | Component — renders `null` when inactive; calls `render` when active |
| `isActive` | Signal — true while intercept is showing |
| `isPending` | Signal — true while `load` is in flight |
| `restore()` | Dismiss intercept (typically `history.back()`) |
| `slot` | Slot key from `defineInterceptors` |
| `path` | Target path pattern |

### Outlet placement

By default, inactive `Outlet` components are **auto-appended** after the owner's rendered output (slot order = object key order). Mount `<interceptors.slot.Outlet />` manually to control DOM position — manually mounted slots are not auto-appended.

### Load / render context

**Load context:**

```ts
{
  params,       // target route params
  location,     // { pathname, params }
  signal,       // abort on navigation away
  context,      // CustomRequestContext
}
```

**Render context** adds:

```ts
{
  data, error,  // discriminated like PageProps
  restore,      // dismiss intercept
  reload,       // re-run load without dismissing
}
```

Use `buildInterceptSuccessResult(data)` / `buildInterceptErrorResult(error)` when implementing custom load pipelines.

### Prefetch

`<Link prefetch>` prefetches interceptor `load` when the link would soft-intercept from the current page.

---

## API reference

```ts
import {
  defineInterceptors,
  buildInterceptSuccessResult,
  buildInterceptErrorResult,
  type InterceptorSlotDefinition,
  type InterceptorHandle,
} from "kiru/router"
```

```ts
function defineInterceptors<
  const T extends Record<string, InterceptorSlotDefinition>
>(definitions: T): { [K in keyof T]: InterceptorHandle }

type InterceptorSlotDefinition = {
  path: NavigatePath
  from?: string
  load?: (ctx: InterceptLoadContext) => Data | Promise<Data>
  render: (ctx: InterceptRenderContext) => JSX.Element
}

type InterceptLoadContext = {
  params: Record<string, string | undefined>
  location: RouteLocation
  signal: AbortSignal
  context: CustomRequestContext
}

type InterceptLoadResult<Data> =
  | { data: Data; error: null }
  | { data: null; error: Error }

type InterceptRenderContext = InterceptLoadContext & {
  restore: () => void
  reload: () => void
} & InterceptLoadResult<unknown>

type InterceptorHandle = {
  Outlet: Kiru.Component
  isActive: Kiru.Signal<boolean>
  isPending: Kiru.Signal<boolean>
  restore: () => void
  reload: () => void
}
```

`NavigatePath` and `RouteParams` are defined in [navigation-and-guards.md](./navigation-and-guards.md) and [routes-and-scopes.md](./routes-and-scopes.md). `RouteLocation` is in [navigation-and-guards.md](./navigation-and-guards.md).

Build-time discovery (server/tooling):

```ts
import {
  discoverRouteInterceptors,
  INTERCEPTOR_MANIFEST_FILENAME,
} from "kiru/router"
```

`discoverRouteInterceptors` scans route modules and emits `kiru-interceptor-manifest.json` for the Vite build.

Navigation option:

```ts
router.navigate("/photos/123")                    // intercept: true (default)
router.navigate("/photos/123", { intercept: false })
<Link to="/photos/[id]" params={{ id: "1" }} intercept={false} />
```

---

## Examples

### Basic — login modal on layout

```tsx
import { defineInterceptors, Link } from "kiru/router"

export const interceptors = defineInterceptors({
  login: {
    path: "/login",
    render: ({ restore }) => (
      <dialog open>
        <h2>Sign in</h2>
        <LoginForm onSuccess={restore} />
        <button type="button" onclick={restore}>Close</button>
      </dialog>
    ),
  },
})

export default function RootLayout({ children }) {
  return () => (
    <div>
      <header>
        <Link to="/login">Sign in</Link>
      </header>
      <main>{children}</main>
    </div>
  )
}
```

Outlets auto-append after layout output.

### Intermediate — photo lightbox (layout-owned)

```tsx
export const interceptors = defineInterceptors({
  photo: {
    path: "/photos/[id]",
    render: ({ params, restore }) => (
      <div class="lightbox" onclick={restore}>
        <img src={`/photos/${params.id}/full.jpg`} alt="" />
      </div>
    ),
  },
})
```

Navigating from `/photos` or `/` to `/photos/42` shows the lightbox; refreshing `/photos/42` renders the full photo page.

### Intermediate — post modal with load and error retry

```tsx
import { defineInterceptors } from "kiru/router"
import { getPost } from "./posts.remote"

export const interceptors = defineInterceptors({
  post: {
    path: "/p/[id]",
    load: async ({ params, signal }) => getPost({ id: params.id }, { signal }),
    render: ({ params, data, error, restore, reload }) => {
      if (error) {
        return (
          <dialog open>
            <p>{error.message}</p>
            <button type="button" onclick={reload}>Retry</button>
            <button type="button" onclick={restore}>Close</button>
          </dialog>
        )
      }
      return (
        <dialog open>
          <h2>{data.title}</h2>
          <article>{data.body}</article>
          <button type="button" onclick={restore}>Close</button>
        </dialog>
      )
    },
  },
})
```

### Advanced — page-only intercept

```tsx
// pages/about.tsx — intercept only when leaving /about
export const interceptors = defineInterceptors({
  user: {
    path: "/users/[id]",
    render: ({ params, restore }) => <UserPeek id={params.id} onClose={restore} />,
  },
})

export default function AboutPage() {
  return () => (
    <main>
      <h1>About</h1>
      <Link to="/users/[id]" params={{ id: "1" }}>View user</Link>
    </main>
  )
}
```

From `/about`, user links soft-intercept. From other pages, `/users/1` is a hard navigation.

### Advanced — manual outlet placement

```tsx
export const interceptors = defineInterceptors({
  post: { path: "/p/[id]", render: PostModal },
})

export default function RootLayout({ children }) {
  return () => (
    <div class="app-shell">
      <aside class="sidebar">{/* … */}</aside>
      <main>{children}</main>
      {/* Modal renders above main, not after entire layout */}
      <interceptors.post.Outlet />
    </div>
  )
}
```

### Advanced — force full navigation

```tsx
<Link to="/p/[id]" params={{ id: post.id }} intercept={false}>
  Open full page
</Link>
```

```ts
await router.navigate({ pathname: `/p/${id}` }, { intercept: false })
```

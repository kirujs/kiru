# Navigation & guards

## Overview

Client navigation is driven by a **router instance** created with `createRouter` (or implicitly via `createRouterApp`). The router exposes signals for the current location, methods to navigate programmatically, and hooks for route-level guards.

`Link` renders anchor elements with typed `to` / `params`, optional prefetch, and intercept control. `RouterView` renders the matched route subtree inside `RouterProvider`.

---

## How it works

### Navigation lifecycle

```
intent (Link click / navigate())
  → component guards (leave / update)
  → route middleware (server + client)
  → interceptor match? → intercepted (soft nav) OR continue
  → loader execution
  → commit → enter guards → afterEach hooks
```

### NavigationResult

```ts
type NavigationResult = {
  status: "committed" | "aborted" | "redirected" | "intercepted"
  // …location fields when committed/redirected
}
```

- **committed** — URL and outlet updated
- **aborted** — guard or `{ abort: true }` middleware cancelled
- **redirected** — middleware or guard returned a redirect target
- **intercepted** — soft navigation; see [interceptors.md](./interceptors.md)

### Router signals

| Signal | Type | Meaning |
|--------|------|---------|
| `pathname` | `string` | Current path |
| `params` | `Record<string, string>` | Dynamic segments |
| `query` | `RouterQuery` | Parsed search params |
| `hash` | `string` | URL hash |
| `match` | `RouteMatch \| null` | Active leaf match |
| `matches` | `RouteTreeMatchSegment[]` | Scope chain |
| `isNavigating` | `boolean` | Transition in flight |
| `currentNavigation` | `CurrentNavigation \| null` | Active nav metadata |
| `loaderEpoch` | `number` | Bumps on loader invalidation |
| `interceptState` | object | Active interceptor slot, if any |
| `isLoaderPending` | `boolean` | Outlet waiting on loader |

### Navigate input

```ts
type RouterNavigateInput =
  | string                    // "/about" or full path
  | { pathname, query?, hash?, locale? }
```

Options: `{ replace?: boolean, intercept?: boolean }` — `intercept` defaults to `true`.

### Search params

`useSearchParams()` returns a reactive query object. For validated params:

```ts
const sort = useSearchParams(sortSchema)
router.setQuery({ sort: "hot" })
```

`createQueryValidation(schema)` builds a schema-bound helper for loaders and components.

### Prefetch

`Link prefetch` prefetches route modules and, when applicable, interceptor `load` functions. Modes: `true`, `"intent"` (hover), or `"render"`.

`prefetchRoute(router, to, options?)` imperatively warms the same caches.

### Guards

| Hook | When | Can block? |
|------|------|------------|
| `onBeforeRouteLeave` | Leaving current route | Yes — return `false` or redirect |
| `onBeforeRouteUpdate` | Same route, params/query change | Yes |
| `onAfterRouteEnter` | After commit | No — side effects only |

```ts
type NavigationGuard = (to, from) => false | void | string | { path: string }
```

Guards register per-component and auto-unsubscribe on unmount via `onCleanup`.

### Static router

`createStaticRouter({ routes, pathname, … })` creates a non-navigating router for SSR string render or tests. No history integration.

### Invalidation

`router.invalidate({ routeIds?: string[] })` bumps `loaderEpoch` and refetches affected loaders.

---

## API reference

### Router

```ts
import {
  createRouter,
  createStaticRouter,
  RouterProvider,
  RouterView,
  useRouter,
  useOptionalRouter,
  useParams,
  useSearchParams,
  useMatches,
  Link,
  prefetchRoute,
  type NavigationResult,
  type RouterNavigateInput,
} from "kiru/router"
```

```ts
type Router = {
  navigate(to, replaceOrOptions?): Promise<NavigationResult>
  setQuery(query, { replace? }): Promise<NavigationResult>
  setHash(hash, { replace? }): Promise<NavigationResult>
  setLocale(locale, { replace? }): Promise<NavigationResult>  // when i18n enabled
  resolveHref(to, { locale?, params? }): string
  invalidate({ routeIds? }): Promise<void>
  afterEach(hook): () => void
  back(): void
  forward(): void
  go(delta): void
  // signals: pathname, params, query, hash, match, …
}
```

### Guards

```ts
import {
  onBeforeRouteLeave,
  onBeforeRouteUpdate,
  onAfterRouteEnter,
} from "kiru/router"
```

### Navigation types

```ts
type NavigationResult =
  | { status: "committed" }
  | { status: "intercepted" }
  | { status: "cancelled" }
  | { status: "redirected"; to: NavigationRedirect }
  | { status: "errored"; error: unknown }

type NavigationRedirect =
  | string
  | { path: string; replace?: boolean }

type RouterNavigateInput =
  | string
  | ({ pathname: string } & NavigateParamsOption<NavigatePath>)

type RouterNavigateCallOptions = {
  replace?: boolean
  intercept?: boolean
  params?: Record<string, string | undefined>
  locale?: string | false
}

type NavigatePath = /* AppRoutePath when RouteTree is augmented; else string */
type RouterQuery = Record<string, string[]>

type RouteLocation = {
  pathname: string
  params: Record<string, string>
}

type NavigationFailure =
  | { type: "cancelled" }
  | { type: "redirect"; to: NavigationRedirect }
  | { type: "error"; error: unknown }

type NavigationGuard = (
  to: RouteLocation,
  from: RouteLocation | null
) => void | true | false | NavigationRedirect | Promise<...>

type AfterEachHook = (
  to: RouteLocation,
  from: RouteLocation | null,
  failure?: NavigationFailure
) => void
```

`NavigatePath` and `RouteParams` are defined in [routes-and-scopes.md](./routes-and-scopes.md).

### Link props

```ts
type LinkPrefetch = boolean | "intent" | "render" | { trigger?: ...; chunks?: boolean; data?: boolean }

type LinkProps = LinkBase & {
  to: NavigatePath   // or string when RouteTree is not augmented
  params?: Record<string, string | undefined>  // required when path has [param] segments
  replace?: boolean
  intercept?: boolean   // default true
  prefetch?: LinkPrefetch
  locale?: string | false
  children?: JSX.Children
  // …standard anchor attributes except href
}
```

---

## Examples

### Basic — Link and programmatic navigate

```tsx
import { Link, useRouter } from "kiru/router"

export default function Nav() {
  const router = useRouter()
  return () => (
    <nav>
      <Link to="/">Home</Link>
      <Link to="/about">About</Link>
      <button type="button" onclick={() => router.navigate("/contact")}>
        Contact
      </button>
    </nav>
  )
}
```

### Intermediate — Link with params and prefetch

```tsx
<Link
  to="/posts/[id]"
  params={{ id: post.id }}
  prefetch="intent"
>
  {post.title}
</Link>
```

### Intermediate — unsaved changes guard

```tsx
import { onBeforeRouteLeave } from "kiru/router"
import { signal } from "kiru"

export default function EditorPage() {
  const dirty = signal(false)
  onBeforeRouteLeave(() => {
    if (dirty.value && !confirm("Discard unsaved changes?")) {
      return false
    }
  })
  return () => <textarea oninput={() => { dirty.value = true }} />
}
```

### Intermediate — validated search params

```ts
import { z } from "zod"

const searchSchema = z.object({
  sort: z.enum(["hot", "new", "top"]).default("hot"),
  page: z.coerce.number().default(1),
})
```

```tsx
import { useSearchParams, Link } from "kiru/router"

export default function FeedPage() {
  const query = useSearchParams(searchSchema)
  return () => (
    <div>
      <p>Sort: {query.sort.value}</p>
      <Link to="/feed" query={{ sort: "new", page: "1" }}>New</Link>
    </div>
  )
}
```

### Advanced — observe navigation in progress

```tsx
import { useRouter } from "kiru/router"

export default function NavStatus() {
  const router = useRouter()
  return () => (
    <div data-testid="nav-status">
      {router.isNavigating.value ? (
        <span>Navigating to {router.currentNavigation.value?.to.pathname}</span>
      ) : (
        <span>Idle at {router.pathname.value}</span>
      )}
    </div>
  )
}
```

### Advanced — i18n locale switch

```tsx
import { useRouter } from "kiru/router"

export default function LocaleSwitcher() {
  const router = useRouter()
  return () => (
    <select
      value={router.locale?.value ?? "en"}
      onchange={(e) => router.setLocale(e.target.value, { replace: true })}
    >
      <option value="en">English</option>
      <option value="fr">Français</option>
    </select>
  )
}
```

### Advanced — invalidate loaders after data change

```tsx
import { useRouter } from "kiru/router"
import { deleteTodo } from "./todos.remote"

export default function TodoItem({ id }: { id: string }) {
  const router = useRouter()
  return () => (
    <button
      type="button"
      onclick={async () => {
        await deleteTodo({ id })
        await router.invalidate()
      }}
    >
      Delete
    </button>
  )
}
```

# Request context

## Overview

Request context carries **per-request data** from the server into loaders, middleware, remote handlers, and React components. Typical uses: authenticated user, tenant ID, feature flags, request-scoped database connections.

On pure CSR/SSG without a server, context defaults to `{}`. SSR injects context into the HTML, hydrates it on the client, and provides it via `useRequestContext()`.

---

## How it works

### Typing

Augment `CustomRequestContext` via module augmentation:

```ts
declare module "kiru/router" {
  interface CustomRequestContext {
    user: { id: string; name: string } | null
    tenantId: string
  }
}
```

All consumers — middleware, loaders, components, remote handlers — share this type.

### SSR pipeline

1. Adapter/renderer calls `getRequestContext(request)` per HTTP request.
2. Server embeds JSON in `<script type="application/json" k-request-context>…</script>`.
3. Client bootstrap calls `readHydratedRequestContext()` — parses and removes the script.
4. `RequestContextProvider` wraps the app with the hydrated value.
5. `useRequestContext()` reads from provider (or SSR scope during render).

### Remote handler access

Inside `query()` / `mutation()` handlers:

```ts
const { context } = getRequestEvent()
// same shape as useRequestContext()
```

`getRequestEvent()` also exposes `cookies`, `request`, `signal`, and `redirect`.

### Explicit provider

Wrap subtrees manually when testing or embedding routed apps:

```tsx
<RequestContextProvider value={{ user: mockUser }}>
  <RouterProvider router={router}>
    <RouterView />
  </RouterProvider>
</RequestContextProvider>
```

`useOptionalRequestContext()` returns `{}` without throwing when outside a provider.

### CSR behavior

Without a server, `useRequestContext()` returns `{}` unless you pass a provider. Middleware `context` is likewise empty on client-only navigations unless you populate it client-side (unusual).

---

## API reference

```ts
import type { CustomRequestContext } from "kiru/router"

import {
  useRequestContext,
  useOptionalRequestContext,
  RequestContextProvider,
  serializeRequestContextScript,
  readHydratedRequestContext,
} from "kiru/router"
```

### Server adapter option

```ts
import type { GetRequestContext } from "@kirujs/adapter-node"

type GetRequestContext = (request: Request) => CustomRequestContext | Promise<CustomRequestContext>
```

Pass to `createKiruHandler` or `createRenderer`:

```ts
createKiruHandler({
  routes,
  getRequestContext: async (request) => ({
    user: await resolveSession(request),
  }),
})
```

### Remote access

```ts
import { getRequestEvent } from "kiru/remote"

const { context, cookies, request, signal } = getRequestEvent()
```

---

## Examples

### Basic — declare typed context

```ts
// app-context.d.ts
declare module "kiru/router" {
  interface CustomRequestContext {
    user: { id: string; email: string } | null
  }
}
```

### Intermediate — server supplies session

```ts
// server.ts
import { createKiruHandler } from "@kirujs/adapter-node"

export default createKiruHandler({
  routes,
  async getRequestContext(request) {
    const session = await readSessionCookie(request)
    return {
      user: session ? await loadUser(session.userId) : null,
    }
  },
})
```

### Intermediate — page reads context

```tsx
import { useRequestContext } from "kiru/router"

export default function DashboardPage() {
  const ctx = useRequestContext()
  return () => (
    <main>
      {ctx.user ? (
        <p>Welcome, {ctx.user.email}</p>
      ) : (
        <p>Please sign in</p>
      )}
    </main>
  )
}
```

### Advanced — middleware + loader + remote share context

```ts
// middleware uses context.user
const authMw: RouteMiddleware = ({ context, to }) => {
  if (to.meta.requiresAuth && !context.user) {
    return { redirect: "/login" }
  }
}
```

```tsx
// loader uses context
export const load = serverLoader(async ({ context }) => ({
  todos: await listTodos(context.user!.id),
  fallback: () => <Skeleton />,
}))
```

```ts
// remote uses same user via getRequestEvent
export const createTodo = mutation(async () => {
  const { context } = getRequestEvent()
  return insertTodo(context.user!.id, "New task")
})
```

### Advanced — test with explicit provider

```tsx
import { RequestContextProvider, RouterProvider, RouterView } from "kiru/router"

const router = createRouter({ routes })

mount(
  <RequestContextProvider value={{ user: { id: "test", email: "t@example.com" } }}>
    <RouterProvider router={router}>
      <RouterView />
    </RouterProvider>
  </RequestContextProvider>,
  container
)
```

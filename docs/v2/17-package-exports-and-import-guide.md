# Package exports and import guide

Correct imports prevent **wrong bundle behavior** (e.g. `serverLoader` in CSR client). This maps `kiru` package.json `exports` to use cases.

Source: `packages/lib/package.json`.

---

## Core packages

| Package | Name | Role |
|---------|------|------|
| `packages/lib` | `kiru` | Renderer, router, remote, jsx |
| `packages/vite-plugin-kiru` | `vite-plugin-kiru` | Build |
| `packages/runtime` | `@kirujs/runtime` | Deploy capabilities |
| `packages/file-routes` | `@kirujs/file-routes` | FS routes |
| `packages/adapter-*` | `@kirujs/adapter-node` etc. | HTTP |

---

## `kiru` export map

### `kiru` (root)

Full library — DOM, signals, components. Use when not routing.

### `kiru/router`

**Server-safe** router API: `createRenderer`, `compileRouteTree`, loaders, middleware types, ISR, sitemap.

**Browser:** package.json maps to `kiru/router/client` for smaller client subset.

**Rule:** Server code imports from `kiru/router`. Client code that only needs `Link`/`createRouter` should use mode-specific bootstrap or `kiru/router/client` if re-exported there.

### `kiru/router/csr`

```typescript
import { createRouterApp } from "kiru/router/csr"
import { Link, createRoute, createRouteTree, useRouter } from "kiru/router" // types/helpers often from main router
```

Sets `__KIRU_ROUTER_BOOTSTRAP__ = "csr"`.

### `kiru/router/ssr`

```typescript
import { createRouterApp } from "kiru/router/ssr"
```

Sets bootstrap `ssr`. Enables loader RPC + remote dispatch on client.

### `kiru/router/ssg`

```typescript
import { createRouterApp } from "kiru/router/ssg"
```

Sets bootstrap `ssg`. Static hydration; no server loader RPC unless hybrid misconfigured.

### `kiru/ssr/router`

Low-level:

```typescript
import { bootstrapSsrClient, bootstrapSsgClient } from "kiru/ssr/router"
```

Use when not using `createRouterApp` wrappers.

### `kiru/ssr/server` / `kiru/ssr/client`

Streaming primitives (`renderToReadableStream`, `hydrate`) — advanced.

### `kiru/remote`

```typescript
import {
  query,
  mutation,
  form,
  getRequestEvent,
  createFormController,
} from "kiru/remote"

// Read
export const ping = query(async () => {
  const { context } = getRequestEvent()
  return { ok: true, user: context.user }
})

// Write
export const save = mutation({
  schema: saveSchema,
  handler: async (input) => persist(input),
})

// Form — redirect via getRequestEvent()
export const login = form({
  handler: async () => {
    const { redirect } = getRequestEvent()
    return redirect(303, "/app")
  },
})
```

Browser field may point to `remote/browser.js` for client stubs.

### `kiru/jsx-runtime` / `kiru/jsx-dev-runtime`

JSX automatic runtime.

---

## Import rules by app mode

| Need | Server import | Client import |
|------|---------------|---------------|
| Renderer | `createRenderer` from `kiru/router` | — |
| SPA mount | — | `createRouterApp` from `kiru/router/csr` |
| SSR hydrate | — | `createRouterApp` from `kiru/router/ssr` |
| SSG hydrate | — | `createRouterApp` from `kiru/router/ssg` |
| Actions define | `kiru/remote` in `.actions.ts` | codegen stub |
| Adapter | `@kirujs/adapter-node` | — |

---

## Anti-patterns

| Wrong | Why |
|-------|-----|
| `createRouterApp` from `kiru/router/csr` on SSR HTML | No hydrated outlet / loader data |
| `serverLoader` page in SSG-only client | Dev warning; RPC fails |
| `createRenderer` without `actions.secret` but forms expect POST | Actions 404 |
| Import full `kiru/router` in lazy client chunk | Pulls server-only code unless tree-shaken |

---

## `browser` field shims

package.json `browser` replaces:

- `preloadRegistry.server` → client
- `actionInvokeScope` → client

Ensures client bundles do not pull Node-only paths.

---

## Optional peer dependencies

| Peer | Purpose |
|------|---------|
| `@standard-schema/spec` | Loader/search validation |

Image optimization (`kiru/image`) was removed in v2.0; planned v2.1+ per [21-image-pipeline-adr.md](./21-image-pipeline-adr.md).

---

## TypeScript augmentation

```typescript
// env.d.ts or global.d.ts
declare module "kiru/router" {
  interface CustomRequestContext { user: User | null }
  interface RouteMeta { requiresAuth?: boolean }
  interface RoutePaths { "/": {}; "/dashboard": {} }
  interface Internationalization { config: typeof i18n }
}
```

---

## Vite alias

Usually no alias needed — use exports map. Custom monorepos may alias `kiru` to `packages/lib/src` for local dev (not recommended for published apps).

---

## Further reading

- [03-rendering-modes.md](./03-rendering-modes.md)
- [01-architecture.md](./01-architecture.md)
- [13-vite-plugin-and-build-pipeline.md](./13-vite-plugin-and-build-pipeline.md)

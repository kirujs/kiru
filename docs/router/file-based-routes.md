# File-based routing

Kiru can generate a route tree from a `src/pages` directory. The generator writes **`src/routes.gen.ts`**, which uses the same [`createRouteTree`](../../packages/lib/src/router/createRouteTree.ts) API as hand-written routes. Runtime matching is unchanged.

## Enable in Vite

```ts
// vite.config.ts
import kiru from "vite-plugin-kiru"

export default defineConfig({
  plugins: [
    kiru({
      router: {
        fileRoutes: true,
        // Optional: combine with SSG (defaults routes to ./src/routes.gen.ts)
        // ssg: true,
      },
    }),
  ],
})
```

### Options

```ts
fileRoutes: {
  dir?: string       // default "./src/pages"
  outFile?: string   // default "./src/routes.gen.ts"
  pageFiles?: string[] // default ["page.{tsx,ts,jsx,js}", "index.{tsx,ts,jsx,js}"]
  extend?: string    // module exporting `extendRoutes` (see below)
}
```

`pageFiles` globs are matched against **filenames** in each route directory (add `page.mdx` when using MDX).

## App wiring

```ts
// src/routes.ts — stable import surface
export { routes } from "./routes.gen"
```

Import `routes` from `./routes.ts` or `./routes.gen` in `main.tsx` / `server.ts`.

### Commit policy

**Commit `routes.gen.ts`** to git so CI and editors see the tree without running Vite. The plugin regenerates the file in dev (with HMR invalidation) and on `buildStart` when content changes.

### Development regeneration

On `vite dev`, the plugin:

1. Writes `routes.gen.ts` on server start (`configResolved` and `configureServer`).
2. Watches `pagesDir` (and `extend`, if configured) for `add` / `change` / `unlink`.
3. Debounces rescans (~50ms), rewrites `routes.gen.ts` when the tree changes, and invalidates the module in Vite’s graph.

Add or remove a `page.tsx` under `src/pages` and the route list updates without restarting the dev server. Covered by `packages/vite-plugin-kiru/src/fileRoutesDev.integration.test.ts`.

## Filesystem conventions

| File | Role |
|------|------|
| `page.{tsx,ts,jsx,js}` | Leaf route (configurable via `pageFiles`) |
| `index.{tsx,...}` | Leaf alias at the same URL segment |
| `layout.{tsx,...}` | Scope layout |
| `middleware.ts` | Scope middleware (static import in generated file) |
| `error.{tsx,...}` | Scope error boundary |
| `not-found.{tsx,...}` | Scope `notFound` |
| `(group)/` | Route group — no URL segment |
| `[id]/`, `[...slug]/`, `[[id]]/`, `[[...slug]]/` | Dynamic URL segments |
| `_private/` | Ignored (no routes under `_` segments) |

Example layout:

```
src/pages/
  layout.tsx
  page.tsx              → /
  about/page.tsx        → /about
  guarded/
    middleware.ts       → redirect / scope middleware
    page.tsx            → /guarded
  blog/[slug]/page.tsx  → /blog/[slug]
  (marketing)/pricing/page.tsx → /pricing
```

Path rules match [02-route-tree.md](../v2/02-route-tree.md#dynamic-segments) (`manifest.ts` scoring).

## Middleware in tree

Co-located `middleware.ts` attaches to the **nearest directory scope**. Codegen statically imports the module and passes it through `collectRouteMiddlewareModule` from `kiru/router`.

Supported shapes:

```ts
import type { RouteMiddleware } from "kiru/router"

export const middleware: RouteMiddleware = (ctx) => {
  if (!ctx.context.user) {
    return { redirect: `/login?next=${encodeURIComponent(ctx.to.href)}` }
  }
}
```

```ts
import type { RouteMiddleware } from "kiru/router"

const guard: RouteMiddleware = (ctx) => ({ redirect: "/about" })
export default guard
```

```ts
import { requireAuth, logging } from "@/my-middlewares.js"

export default [requireAuth, logging]
```

You can combine `export default` (function or array) with a named `export const middleware` (function or array); handlers run in that order.

Order at runtime: ancestor scopes (root first) → leaf (see [route-middleware-and-context.md](./route-middleware-and-context.md)).

## Extend hand-written routes

```ts
// src/routes.extend.ts
import { createRoute } from "kiru/router"

export const extendRoutes = [
  createRoute("/manual", () => import("./manual.tsx")),
] as const

declare module "kiru/router" {
  interface ExtendedRouteTree {
    routes: typeof extendRoutes
  }
}
```

```ts
fileRoutes: { extend: "./src/routes.extend.ts" }
```

Codegen spreads `...extendRoutes` into the generated tree `children` array. Register extended paths for type-safe `Link` / `navigate` **only** in the extend file (`ExtendedRouteTree`); `routes.gen.ts` imports `extendRoutes` and does not repeat that augmentation.

## Package

Scan/codegen logic lives in [`@kirujs/file-routes`](../../packages/file-routes). The Vite plugin watches `pagesDir` and rewrites `routes.gen.ts` on change.

## E2E

[`e2e/file-routes`](../../e2e/file-routes) — middleware redirect, dynamic `[slug]`, `(marketing)/pricing`, not-found, and [`src/routes.extend.ts`](../../e2e/file-routes/src/routes.extend.ts) adding `/manual`.

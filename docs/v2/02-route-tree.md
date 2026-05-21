# Route tree — `createRouteTree`

The route tree is the **single source of truth** for URLs, layouts, static prerender, SEO head, middleware, and error boundaries.

## Basic shape

Every app exports a tree from `src/routes.ts`:

```ts
import { createRoute, createRouteTree } from "kiru/router"

const r0 = createRoute("/", () => import("./pages/index.tsx"))
const r1 = createRoute("/about", () => import("./pages/about.tsx"))

export const routes = createRouteTree({
  layout: () => import("./pages/layout.tsx"),
  notFound: () => import("./pages/not-found.tsx"),
  children: [r0, r1],
})

declare module "kiru/router" {
  interface RouteTree {
    routes: [typeof r0, typeof r1]
  }
}
```

`createRouteTree` builds a **scope root** internally. Register leaf routes in `RouteTree` so `Link`, `navigate`, and `useParams` infer path params.

Implementation: `packages/lib/src/router/createRouteTree.ts` → `compileRouteTree` in `manifest.ts`.

Optional **file-based routing** generates this tree from `src/pages` — see [file-based-routes.md](../router/file-based-routes.md).

## Scopes vs pages

| API | `kind` | Purpose |
|-----|--------|---------|
| `createRouteScope({ ... })` | `scope` | Layout wrapper, shared `meta`, `middleware`, `static`, context policy |
| `createRoute(path, ...)` | `route` | Leaf URL + page component |

### Page shorthand

```ts
// Shorthand: component loader only
createRoute("/about", () => import("./pages/about.tsx"))

// Full config object
createRoute("/about", {
  component: () => import("./pages/about.tsx"),
  static: true,
  head: { title: "About" },
  meta: { requiresAuth: false },
  middleware: [myMiddleware],
  error: () => import("./pages/about-error.tsx"),
})
```

## `static: true` — prerender eligibility

`static` on a **scope** applies to all descendant pages unless overridden. Only routes in the compiled manifest with `static: true` are included in `generateStaticPaths` / SSG build.

**Example — hybrid docs slice** (`sandbox/ssr/src/routes.ts`):

```ts
createRoute("/docs", {
  static: true,
  component: () => import("./pages/docs.tsx"),
  head: {
    title: "Docs — Kiru SSR (static)",
    description: "Prerendered documentation slice.",
  },
}),
```

With `router.ssg` + `router.serverEntry`, `/docs` is written to `dist/client/docs/index.html` (or `docs.html`) at build time; production server serves disk HTML before SSR.

**Example — full static site** (`e2e/ssg/src/routes.ts`):

```ts
createRouteTree({
  static: true,
  children: [
    createRoute("/", { component: () => import("./pages/index.tsx"), ... }),
    createRoute("/posts/[slug]", { component: () => import("./pages/post.tsx"), ... }),
  ],
})
```

Dynamic static segments need `generateStaticParams` on the **page module** (see below).

## Dynamic segments

Supported patterns (see `manifest-routing.test.ts`):

| Pattern | Matches |
|---------|---------|
| `[id]` | Required segment |
| `[...slug]` | Catch-all |
| `[[id]]` | Optional segment |
| `[[...slug]]` | Optional catch-all |

**CSR example** (`e2e/csr/src/routes.ts`):

```ts
r.page("/users/[id]", () => import("./pages/users/[id]/index.tsx")),
```

## `generateStaticParams` / `generateSitemapParams`

Export from the **page module** (not `routes.ts`):

```ts
// pages/post.tsx — used at SSG build for /posts/[slug]
export async function generateStaticParams() {
  return [{ slug: "hello" }, { slug: "world" }]
}
```

`generateSitemapParams` is the same shape but driven by `site.config.ts` `sitemap.include` for non-static SSR routes you still want in the sitemap.

## Layouts and `notFound`

```ts
r.scope({
  layout: () => import("./layout.tsx"),
  notFound: () => import("./not-found.tsx"),
  children: [ /* pages */ ],
})
```

Layouts nest by scope depth. `notFound` renders when `matchRoute` returns null.

## Error boundaries

Scope-level and page-level `error` modules receive `ErrorPageProps`:

```ts
r.page("/break-ssr-leaf", {
  component: () => import("./pages/break-ssr-leaf.tsx"),
  error: () => import("./pages/leaf-error-page.tsx"),
}),
```

SSR catches render errors and renders the nearest `error` module on the matched branch (`sandbox/ssr`).

## Document head (`head`)

Declarative SEO on scope or page (merged child overrides parent):

```ts
r.scope({
  head: { description: "Kiru server-rendered sandbox." },
  children: [
    r.page("/seo", {
      component: () => import("./pages/seo.tsx"),
      head: {
        title: "SEO — Kiru SSR",
        description: "JSON-LD and document head.",
        jsonLd: { "@type": "WebPage", name: "SEO — Kiru SSR" },
      },
    }),
  ],
})
```

Client navigations update `document.title` only (`documentHeadClient.ts` + `pageHead.ts`). Full head tags are emitted on SSR/SSG first paint.

## `meta` — typed policy bag

Augment via module declaration:

```ts
declare module "kiru/router" {
  interface RouteMeta {
    requiresAuth?: boolean
    unauthorizedRedirect?: string
  }
}
```

Attach to scope or page (or `scope.config.ts` / `page.config.ts` with file-based routes):

```ts
createRouteScope({
  meta: { requiresAuth: true },
  middleware: [requireAuth],
  children: [
    createRoute("/users/[id]", () => import("./pages/user.tsx")),
  ],
})
```

Merged **shallowly** along the scope chain to the leaf. See [04-middleware-meta-context.md](./04-middleware-meta-context.md).

## Route middleware on a page

Inline redirect without a separate file (`e2e/csr/src/routes.ts`):

```ts
r.page("/guarded", {
  component: async () => ({
    default: () => "Guarded should redirect",
  }),
  middleware: [() => ({ redirect: "/about" })],
}),
```

## Config types for file-based routes

Export route metadata from co-located config modules:

```ts
import type { RoutePageConfig, RouteScopeConfig } from "kiru/router"

export default { static: true, head: { title: "About" } } satisfies RoutePageConfig
// scope.config.ts — same with RouteScopeConfig
```

See [file-based-routes.md](../router/file-based-routes.md).

## `routeLinks` (E2E only pattern)

`e2e/csr/src/routes.ts` exports `routeLinks` for Cypress — not a framework API; useful as a **docs site example** of keeping marketing nav lists beside the tree.

## Compile output

`compileRouteTree(definition)` → `RouteManifest`:

- `routes[]` with `id`, `path`, `segments`, `params`, `static`, merged `meta`
- Used by `matchRoute`, `generateStaticPaths`, renderer, and CSR router identically

## Use-case cheat sheet

| Goal | Route tree knob |
|------|-----------------|
| Marketing site fully static | `createRouteTree({ static: true, children: [...] })` |
| One static docs page in SSR app | `createRoute("/docs", { static: true, ... })` + hybrid vite config |
| Auth-gated area | `meta` + `middleware` (SSR: populate `ctx.context` via `getRequestContext`) |
| SEO landing | `head` + `static: true` or SSR with `defineISR` |
| Optional blog index | `r.page("/blog/[[page]]", ...)` + `generateStaticParams` |
| Redirect route | `middleware: [() => ({ redirect: "/login" })]` |

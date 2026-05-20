# Route tree — `defineRouteTree`

The route tree is the **single source of truth** for URLs, layouts, static prerender, SEO head, middleware, and error boundaries.

## Basic shape

Every app exports a tree from `src/routes.ts`:

```ts
import { defineRouteTree } from "kiru/router"

export const routes = defineRouteTree((r) =>
  r.scope({
    layout: () => import("./pages/layout.tsx"),
    notFound: () => import("./pages/not-found.tsx"),
    children: [
      r.page("/", () => import("./pages/index.tsx")),
      r.page("/about", () => import("./pages/about.tsx")),
    ],
  })
)
```

`defineRouteTree` requires the builder to return a **scope root** (`r.scope(...)`), not a bare page.

Implementation: `packages/lib/src/router/defineRouteTree.ts` → `compileRouteTree` in `manifest.ts`.

## Scopes vs pages

| Node | `kind` | Purpose |
|------|--------|---------|
| `r.scope({ ... })` | `scope` | Layout wrapper, shared `meta`, `middleware`, `static`, context policy |
| `r.page(path, ...)` | `route` | Leaf URL + page component |

### Page shorthand

```ts
// Shorthand: component loader only
r.page("/about", () => import("./pages/about.tsx"))

// Full config object
r.page("/about", {
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
r.page("/docs", {
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
r.scope({
  static: true,
  children: [
    r.page("/", { component: () => import("./pages/index.tsx"), ... }),
    r.page("/posts/[slug]", { component: () => import("./pages/post.tsx"), ... }),
  ],
}),
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

Attach to scope or page:

```ts
r.scope({
  contextStrategy: "block",
  meta: { requiresAuth: true },
  children: [
    r.page("/users/[id]", { component: () => import("./pages/user.tsx") }),
  ],
}),
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

## Context strategies on scopes

| `contextStrategy` | Behavior |
|-------------------|----------|
| `inherit` | Use app `contextGate` default (`off` or `block`) |
| `none` | No context fetch for this subtree |
| `background` | Resolve context without blocking outlet |
| `block` | Await `resolveContext` before leaf + loaders |

**E2E routes** (`e2e/csr/src/context/defineContextRoutes.tsx`) — copy for docs:

```ts
r.scope({
  contextStrategy: "none",
  static: true,
  children: [r.page("/context", () => import("./pages/home.tsx"))],
}),
r.scope({
  contextStrategy: "background",
  static: true,
  children: [r.page("/context/profile", () => import("./pages/profile.tsx"))],
}),
r.scope({
  contextStrategy: "block",
  contextPendingFallback: () => <ScopeContextPending />,
  meta: { requiresAuth: true, unauthorizedRedirect: "/context/login" },
  middleware: [requireAuth],
  children: [r.page("/context/admin", () => import("./pages/admin.tsx"))],
}),
```

## Merging routes from shared modules

`e2e/ssg` and `e2e/csr` share context demos:

```ts
import { contextRouteChildren } from "../../csr/src/context/defineContextRoutes.js"

export const routes = defineRouteTree((r) =>
  r.scope({
    layout: () => import("./pages/layout.tsx"),
    children: [
      /* static pages... */
      ...contextRouteChildren(r),
    ],
  })
)
```

## `routeLinks` (E2E only pattern)

`e2e/csr/src/routes.ts` exports `routeLinks` for Cypress — not a framework API; useful as a **docs site example** of keeping marketing nav lists beside the tree.

## Compile output

`compileRouteTree(definition)` → `RouteManifest`:

- `routes[]` with `id`, `path`, `segments`, `params`, `static`, merged `meta`
- Used by `matchRoute`, `generateStaticPaths`, renderer, and CSR router identically

## Use-case cheat sheet

| Goal | Route tree knob |
|------|-----------------|
| Marketing site fully static | `r.scope({ static: true, children: [...] })` |
| One static docs page in SSR app | `r.page("/docs", { static: true, ... })` + hybrid vite config |
| Auth-gated area | `meta` + `middleware` + `contextStrategy: "block"` |
| SEO landing | `head` + `static: true` or SSR with `defineISR` |
| Optional blog index | `r.page("/blog/[[page]]", ...)` + `generateStaticParams` |
| Redirect route | `middleware: [() => ({ redirect: "/login" })]` |

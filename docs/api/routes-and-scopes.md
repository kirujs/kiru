# Routes & scopes

## Overview

The route tree is the authoring-time structure that describes your app's URL hierarchy. Two node kinds exist:

- **Scope** — groups children, optional shared `layout`, `error`, `notFound`, and layered `middleware` / `meta` / `head`. Author with **`createRouteScope`** (nested scopes) or **`createRouteTree`** (root scope).
- **Route (leaf)** — a URL pattern with a page `component`. Author with **`createRoute`**.

`compileRouteTree` flattens the tree into a `RouteManifest` used for matching, prerender discovery, sitemap generation, server rendering, and client navigation.

Authoring helpers: `createRoute`, `createRouteScope`, `createRouteTree`.

> There is no `createScope` export — **`createRouteScope`** is the public API for nested scope nodes. `createRouteTree` is sugar for a root scope wrapped in `{ root }`.

---

## `createRoute`

`define` a leaf route: a URL pattern and the lazy page module that renders when that pattern matches.

### Signatures

```ts
import { createRoute, type RouteDefinitionConfig, type PageLoader } from "kiru/router"

// Shorthand — component only
createRoute(path, component: PageLoader)

// Full inline config
createRoute(path, {
  component: PageLoader
  static?: boolean
  head?: RouteHeadMetaInput
  meta?: RouteMetaInput
  middleware?: RouteMiddlewareInput
  error?: ErrorLoader
})

// Deferred config module (file-based routes / large apps)
createRoute(path, {
  component: PageLoader
  config: () => import("./page.config")
  // mutually exclusive with inline static, head, meta, middleware, error
})
```

`createRoute` always sets `kind: "route"` and `method: "GET"` on the returned node. HTTP verbs are not part of the route-tree API — actions and remotes handle mutations separately.

### Path rules

| Rule                             | Detail                                                                                                                                          |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Leading slash                    | Required. `createRoute("about", …)` throws; use `"/about"`.                                                                                     |
| Absolute paths                   | Paths are absolute from the app root (before `baseUrl` policy). Scopes do **not** prefix child paths — every leaf path is the full logical URL. |
| Static segments                  | Literal URL pieces: `"/users/new"`.                                                                                                             |
| Dynamic `[param]`                | One path segment, exposed on `useParams()` and loader `params`.                                                                                 |
| Optional `[[param]]`             | Segment may be absent; missing value is `""`.                                                                                                   |
| Required catch-all `[...rest]`   | Must be the **last** segment. Captures `/`‑separated remainder into one string.                                                                 |
| Optional catch-all `[[...rest]]` | Must be the **last** segment. Matches with or without trailing segments; empty capture is `""`.                                                 |

**Match scoring** (higher wins when multiple patterns could match):

| Segment kind               | Score |
| -------------------------- | ----- |
| Static                     | +4    |
| `[param]`                  | +2    |
| `[...rest]` or `[[param]]` | +1    |
| `[[...rest]]`              | +0    |

Examples: `/users/new` beats `/users/[id]`; `/posts/[page]` beats `/posts/[[page]]` when a page number is present; `/posts/[[page]]` wins for `/posts` alone.

Catch-all segments that are not last throw at compile time:

```
[...slug] must be the last segment in route path
```

### The `component` loader

`component` is a **`PageLoader`**: `() => Promise<PageModule>`.

```ts
// Typical — dynamic import of a page module
createRoute("/about", () => import("./pages/about"))

// Equivalent explicit form
createRoute("/about", {
  component: () => import("./pages/about"),
})
```

The resolved module is either a bare default export or a `PageModule` object (`default`, optional `load`, `head`, `validation`, `isr`, `interceptors`, `generateStaticParams`, `generateSitemapParams`). See [loaders-and-page-data.md](./loaders-and-page-data.md).

Loaders run at navigation/render time; the route tree only stores the `import()` thunk so code-splitting works.

### Inline config fields

| Field        | Purpose                                                                                                                                                                                   |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `component`  | **Required** (except when using the `config` loader pattern). Page module loader.                                                                                                         |
| `static`     | When `true`, leaf is eligible for SSG prerender and static path discovery. When `false`, opts out of a parent scope's `static: true`. Omitted inherits from ancestors.                    |
| `head`       | Declarative SEO defaults for this leaf. Object replaces inherited head; function `(inherited) => head` merges via `mergeRouteHead`. Page `export const head` can still refine at runtime. |
| `meta`       | App metadata (auth flags, roles, etc.). Same object-replaces / function-extends semantics as scopes. Augment `RouteMeta` for typing.                                                      |
| `middleware` | Route middleware for this leaf. Single handler or array **replaces** inherited chain; layer function `(inherited) => [...]` extends it. See [middleware.md](./middleware.md).             |
| `error`      | Error boundary module for render failures on this leaf. Takes precedence over the nearest ancestor scope `error` on the same match.                                                       |

### Deferred `config` loader

For file-based routes or to keep `routes.ts` slim, point at a `page.config.ts` module instead of inlining `static` / `head` / `meta` / `middleware` / `error`:

```ts
createRoute("/pricing", {
  component: () => import("./pages/pricing"),
  config: () => import("./pages/pricing.config"),
})
```

`page.config.ts` exports `default` or `config` (`RoutePageConfig` = `RouteDefinitionConfig` without `component`). `resolveRouteConfig` reads the export.

When `config` is present on a node, **inline** `static`, `head`, `meta`, `middleware`, and `error` are disallowed on that same node (enforced by TypeScript on the authoring helpers). Layout and component loaders stay on the tree node; only metadata moves to the config module.

At runtime, config modules are loaded lazily via `ensureResolvedRouteLayersForMatch` — compile-time layers from `compileRouteTree` are replaced with merged layers after the config module resolves.

### Return type and path literals

`createRoute` is generic over the path string and preserves the literal:

```ts
const home = createRoute("/", () => import("./home"))
// home.path is typed as "/" (not string)
```

Use a `const` array of routes or `declare module "kiru/router" { interface RouteTree { routes: … } }` so `Link`, `navigate`, and `useParams` get typed paths and params. `RouteParams<"/users/[id]">` resolves to `{ id: string }`.

### What compilation does for a leaf

For each `createRoute` node, `compileRouteTree`:

1. Normalizes the path (`/foo//bar` → `/foo/bar`).
2. Builds a `RegExp` and ordered `params` list from segments.
3. Computes `score` for ambiguous matching.
4. Resolves `static` — `false` opts out; otherwise leaf value or any ancestor scope with `static: true`.
5. Layers `head`, `meta`, and `middleware` from root → leaf.
6. Sets `error` to the leaf's `error`, or the nearest scope `error` walking inner → outer.
7. Records `scopes[]` — the ancestor scope chain (outer → inner) for layout nesting.

---

## `createRouteScope`

Define a **scope** node: a branch in the tree that wraps descendant routes with shared layout, boundaries, and layered configuration. Scopes have **no URL of their own** — only their children contribute paths.

### Signature

```ts
import {
  createRouteScope,
  type RouteScopeConfig,
  type LayoutLoader,
} from "kiru/router"

createRouteScope({
  layout?: LayoutLoader
  notFound?: NotFoundLoader
  error?: ErrorLoader
  static?: boolean
  head?: RouteHeadMetaInput
  meta?: RouteMetaInput
  middleware?: RouteMiddlewareInput
  children: RouteTreeChild[]   // required — createRoute and nested createRouteScope nodes
})

// Deferred scope config (same mutual-exclusion rules as createRoute)
createRouteScope({
  layout: () => import("./layouts/dashboard"),
  config: () => import("./dashboard/scope.config"),
  children: [ /* … */ ],
})
```

`createRouteScope` sets `kind: "scope"` on the returned node.

### Config fields

| Field                          | Purpose                                                                                                                                                                                                                                                                  |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `children`                     | **Required.** Array of `createRoute` leaves and/or nested `createRouteScope` branches.                                                                                                                                                                                   |
| `layout`                       | `LayoutLoader` — `() => Promise<LayoutModule>`. Wraps all descendant pages. Layouts nest outer → inner; each receives child outlet content. Layout modules support `default` and optional `interceptors` only (no `load` / `head` / `isr`).                              |
| `notFound`                     | Custom 404 UI when no leaf matches. See [Not-found resolution](#not-found-resolution) below. Root scope `notFound` also enables SSG `404.html` emission (`rootHasNotFound`).                                                                                             |
| `error`                        | Error boundary for render failures under this scope. Leaf `error` overrides scope `error` for matched routes.                                                                                                                                                            |
| `static`                       | When `true`, all descendant leaves inherit static eligibility unless a leaf sets `static: false`.                                                                                                                                                                        |
| `head` / `meta` / `middleware` | Same layering semantics as on `createRoute`. Apply to every descendant leaf (merged per leaf at compile or config-resolve time).                                                                                                                                         |
| `config`                       | Lazy `scope.config.ts` loader (`RouteScopeConfig`). Mutually exclusive with inline `static`, `head`, `meta`, `middleware`, and `error` on the same node. `layout` and `notFound` may still live on the tree node (FBR co-located files override config when both exist). |

### Nesting and layout chain

Scopes can nest arbitrarily. A request matching `/dashboard/settings` with this tree:

```ts
createRouteTree({
  layout: () => import("./layouts/root"),
  children: [
    createRouteScope({
      layout: () => import("./layouts/dashboard"),
      children: [
        createRoute("/dashboard/settings", () => import("./pages/settings")),
      ],
    }),
  ],
})
```

…loads `root` layout → `dashboard` layout → `settings` page module. `match.route.scopes` lists both scope entries in outer → inner order.

### Static inheritance

```ts
createRouteScope({
  static: true,
  children: [
    createRoute("/marketing", () => import("./marketing")), // static
    createRoute("/app", { static: false, component: () => import("./app") }), // dynamic override
  ],
})
```

A scope's `static: true` is OR'd into the ancestor chain at compile time. Only an explicit `static: false` on a leaf opts out.

### Not-found resolution

When `matchRoute` returns `null`, `resolveNotFoundScopes` picks the scope chain with the **longest matching URL prefix** among routes whose ancestor scopes define `notFound`, then uses the **innermost** `notFound` module on that chain.

Practical effect:

- Put `notFound` on the root scope for a global 404 inside the root layout.
- Put `notFound` on a nested scope (e.g. `/blog/*`) to show a section-specific 404 still wrapped in that section's layout.

### Error boundaries

- **Scope `error`** — catches render errors for matched routes under that scope (unless a closer leaf `error` exists).
- **Leaf `error`** — overrides scope errors for that route only.
- **Root `error`** — fallback when no route-specific error module applies (including some SSR failures with no match).

Error modules receive `{ error: Error }`.

### `createRouteScope` vs `createRouteTree`

| API                       | Use when                                                                                                      |
| ------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `createRouteTree({ … })`  | Defining the app root. Returns `{ root: RouteScopeDefinition }` consumed by `compileRouteTree` and bootstrap. |
| `createRouteScope({ … })` | Nesting a layout branch **inside** the root's `children`.                                                     |

`createRouteTree` accepts the same fields as `createRouteScope` — it is equivalent to wrapping one scope as the root:

```ts
// These are equivalent shapes
const a = createRouteTree({ layout: L, children: […] })
const b = { root: createRouteScope({ layout: L, children: […] }) }
```

### Deferred scope config example

```ts
createRouteScope({
  layout: () => import("./threadboard/layout"),
  config: () => import("./threadboard/scope.config"),
  children: [
    createRoute("/threadboard", () => import("./threadboard/page")),
    createRoute("/threadboard/p/[id]", () => import("./threadboard/post")),
  ],
})
```

```ts
// threadboard/scope.config.ts
import type { RouteScopeConfig } from "kiru/router"

export default {
  head: { title: "Threadboard" },
  meta: { requiresAuth: true },
} satisfies RouteScopeConfig
```

---

## Layering: `head`, `meta`, `middleware`

All three follow the same pattern on **both** `createRoute` and `createRouteScope`:

| Input shape  | Behavior                                                                                                                                   |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| **Object**   | Replaces the inherited value from ancestor scopes (no deep merge for `meta` object replace; `head` object replace skips `mergeRouteHead`). |
| **Function** | `(inherited) => value` — `inherited` is fully resolved from ancestors; you extend or transform it.                                         |

**Middleware** additionally:

| Input shape                        | Behavior                                                          |
| ---------------------------------- | ----------------------------------------------------------------- |
| Single `RouteMiddleware`           | Replaces entire inherited chain with `[handler]`.                 |
| `RouteMiddleware[]`                | Replaces entire inherited chain.                                  |
| `(inherited) => RouteMiddleware[]` | Extends — typical pattern: `(inherited) => [...inherited, auth]`. |

```ts
createRouteTree({
  meta: { site: "acme" },
  middleware: [logging],
  children: [
    createRouteScope({
      meta: (m) => ({ ...m, requiresAuth: true }),
      middleware: (mw) => [...mw, requireAuth],
      children: [
        createRoute("/admin", {
          meta: { requiresAuth: true, role: "admin" }, // object replace — role only on this leaf's merged meta
          component: () => import("./admin"),
        }),
      ],
    }),
  ],
})
```

See [middleware.md](./middleware.md) and [head-seo-and-sitemap.md](./head-seo-and-sitemap.md) for runtime behavior.

---

## Compilation & matching

### `compileRouteTree`

`compileRouteTree(definition)` produces:

| Field             | Meaning                                           |
| ----------------- | ------------------------------------------------- |
| `routes`          | Flattened leaves with pattern, score, param names |
| `rootLayout`      | Root scope layout loader                          |
| `rootError`       | Root error boundary module                        |
| `rootHasNotFound` | Whether root defines a custom not-found page      |

Each compiled route includes `scopes[]` (ancestor chain outer → inner), resolved `head`, `meta`, `middleware[]`, and `static` flag.

### `matchRoute`

`matchRoute(manifest, pathname, pathPolicy?)` picks the highest-scoring pattern. `pathPolicy` strips `baseUrl` and normalizes trailing slashes before matching.

### Page modules

A page module is either a bare component or a `PageModuleObject`:

```ts
type PageModule = Kiru.Component<any> | PageModuleObject

type PageModuleObject = {
  default: Kiru.Component<any>
  load?: KiruLoader
  head?: KiruPageHead
  validation?: LoaderValidationConfig
  isr?: KiruISRConfig
  interceptors?: ReturnType<typeof defineInterceptors>
  generateStaticParams?: GenerateStaticParams
  generateSitemapParams?: GenerateSitemapParams
}
```

`GenerateStaticParams` and `GenerateSitemapParams` return `Array<Record<string, string>>` (or a Promise thereof). See [head-seo-and-sitemap.md](./head-seo-and-sitemap.md).

Layout modules (`LayoutModule`) support `default` and optional `interceptors` only — no `load`, `head`, or `isr` on layouts.

### Typed navigation

Codegen or manual augmentation extends `RouteTree`:

```ts
declare module "kiru/router" {
  interface RouteTree {
    routes: "/" | "/about" | "/posts/[id]"
  }
}
```

`Link`, `navigate`, and interceptor `path` values are then typed against known paths and params.

### Config resolution

`resolveRouteConfig(mod)` reads `default` or `config` export from a config module — used by file-based routes for `page.config.ts` / `scope.config.ts`.

---

## Examples

### Basic — flat three-page app

```ts
import { createRoute, createRouteTree } from "kiru/router"

export const routes = createRouteTree({
  children: [
    createRoute("/", () => import("./pages/home")),
    createRoute("/about", () => import("./pages/about")),
    createRoute("/contact", () => import("./pages/contact")),
  ],
})
```

### `createRoute` — shorthand vs full config

```ts
// Shorthand
createRoute("/hello", () => import("./pages/hello"))

// Inline head + static
createRoute("/docs", {
  static: true,
  component: () => import("./pages/docs"),
  head: { title: "Documentation" },
})

// Middleware redirect
createRoute("/guarded", {
  component: () => import("./pages/guarded"),
  middleware: [() => ({ redirect: "/" })],
})
```

### `createRouteScope` — nested dashboard shell

```ts
import { createRoute, createRouteScope, createRouteTree } from "kiru/router"

export const routes = createRouteTree({
  layout: () => import("./layouts/root"),
  children: [
    createRoute("/", () => import("./pages/home")),
    createRouteScope({
      layout: () => import("./layouts/dashboard"),
      meta: { requiresAuth: true },
      middleware: (inherited) => [...inherited, requireAuth],
      children: [
        createRoute("/dashboard", () => import("./pages/dashboard")),
        createRoute("/dashboard/settings", () => import("./pages/settings")),
      ],
    }),
  ],
})
```

### Path segments — dynamic, optional, catch-all

```ts
createRoute("/posts/[id]", () => import("./pages/post-detail"))
createRoute("/blog/[[page]]", () => import("./pages/blog-index")) // /blog and /blog/2
createRoute("/docs/[...slug]", () => import("./pages/docs-catchall")) // /docs/a/b
createRoute("/files/[[...path]]", () => import("./pages/files")) // /files and /files/a/b
```

`useParams()` returns `{ id: "42" }`, `{ page: "" }` or `{ page: "2" }`, `{ slug: "guide/intro" }`, etc.

### Static scope with dynamic opt-out

```ts
createRouteScope({
  layout: () => import("./layouts/marketing"),
  static: true,
  children: [
    createRoute("/", () => import("./pages/home")),
    createRoute("/pricing", () => import("./pages/pricing")),
  ],
})

createRouteScope({
  layout: () => import("./layouts/app"),
  children: [
    createRoute("/app/feed", {
      static: false, // opt out of marketing static even if nested under a static parent elsewhere
      component: () => import("./pages/feed"),
    }),
  ],
})
```

### Layer functions on leaf and scope

```ts
createRouteTree({
  head: { title: "My App", description: "Default description" },
  children: [
    createRoute("/about", {
      component: () => import("./pages/about"),
      head: (inherited) => ({ ...inherited, title: "About — My App" }),
    }),
  ],
})
```

### Scope error, leaf error, and not-found

```ts
export const routes = createRouteTree({
  layout: () => import("./layouts/root"),
  notFound: () => import("./pages/not-found"),
  error: () => import("./pages/error"),
  children: [
    createRouteScope({
      layout: () => import("./layouts/blog"),
      error: () => import("./pages/blog-error"),
      children: [
        createRoute("/blog", () => import("./pages/blog-index")),
        createRoute("/blog/[slug]", () => import("./pages/blog-post")),
        createRoute("/blog/break", {
          component: () => import("./pages/break"),
          error: () => import("./pages/post-error"), // overrides blog-error for this leaf only
        }),
      ],
    }),
  ],
})
```

### Typed `RouteTree` augmentation

```ts
export const routes = createRouteTree({
  children: [createRoute("/posts/[id]", () => import("./pages/post"))],
})

declare module "kiru/router" {
  interface RouteTree {
    routes: "/posts/[id]"
  }
}
```

```tsx
import { Link } from "kiru/router"
;<Link to="/posts/[id]" params={{ id: "hello" }}>
  View post
</Link>
```

### Page co-exports (component lives in the page file, not the tree)

```tsx
// pages/user.tsx
import { serverLoader, defineHeadContent, type PageProps } from "kiru/router"

export const load = serverLoader({
  load: async ({ params }) => fetchUser(params.id),
  fallback: () => <p>Loading user…</p>,
})

export const head = defineHeadContent(({ params }) => ({
  title: `User ${params.id}`,
}))

export default function UserPage({ data, error }: PageProps<typeof load>) {
  if (error) return <p>Error: {error.message}</p>
  return () => (
    <main>
      <h1>{data.name}</h1>
      <p>{data.bio}</p>
    </main>
  )
}
```

```ts
// routes.ts — tree only references the module
createRoute("/users/[id]", () => import("./pages/user"))
```

---

## API reference (types)

### Tree authoring functions

```ts
import { createRoute, createRouteScope, createRouteTree } from "kiru/router"

function createRoute<P extends string>(
  path: P,
  config: PageLoader | RouteDefinitionConfig | RouteDefinitionWithConfigLoader
): CreatedRoute<P>

function createRouteScope(
  config: RouteScopeConfig & { children: RouteTreeChild[] }
): CreatedRouteScope

function createRouteTree(
  config: RouteScopeConfig & { children: RouteTreeChild[] }
): RouteTreeDefinition
```

### Authoring node types

```ts
/** Leaf route returned by createRoute — preserves const path literal. */
type CreatedRoute<P extends string = string> = RouteDefinition & {
  readonly path: P
}

/** Scope node returned by createRouteScope. */
type CreatedRouteScope = RouteScopeDefinition

type RouteTreeChild = CreatedRoute<string> | CreatedRouteScope

/** Root wrapper consumed by compileRouteTree and bootstrap. */
type RouteTreeDefinition = {
  root: RouteScopeDefinition
}

/** Authoring-time scope node (kind: "scope"). */
type RouteScopeDefinition = {
  kind: "scope"
  static?: boolean
  layout?: LayoutLoader
  notFound?: NotFoundLoader
  error?: ErrorLoader
  config?: RouteConfigLoader<RouteScopeConfig>
  head?: RouteHeadMetaInput
  meta?: RouteMetaInput
  middleware?: RouteMiddlewareInput
  children: RouteNodeDefinition[]
}

/** Authoring-time leaf node (kind: "route"). */
type RouteDefinition = {
  kind: "route"
  method: "GET"
  path: string
  component: PageLoader
  config?: RouteConfigLoader<RoutePageConfig>
  static?: boolean
  head?: RouteHeadMetaInput
  meta?: RouteMetaInput
  middleware?: RouteMiddlewareInput
  error?: ErrorLoader
}

type RouteNodeDefinition = RouteDefinition | RouteScopeDefinition
```

### Route config shapes

```ts
type RouteDefinitionConfig = {
  component: PageLoader
  static?: boolean
  head?: RouteHeadMetaInput
  meta?: RouteMetaInput
  middleware?: RouteMiddlewareInput
  error?: ErrorLoader
}

/** Deferred page.config.ts — mutually exclusive with inline static/head/meta/middleware/error. */
type RouteDefinitionWithConfigLoader = {
  component: PageLoader
  config: RouteConfigLoader<RoutePageConfig>
}

/** File-based page.config.ts / scope.config.ts fields (no component / children). */
type RoutePageConfig = Omit<RouteDefinitionConfig, "component">

type RouteScopeConfig = {
  layout?: LayoutLoader
  notFound?: NotFoundLoader
  error?: ErrorLoader
  static?: boolean
  head?: RouteHeadMetaInput
  meta?: RouteMetaInput
  middleware?: RouteMiddlewareInput
}

type RouteConfigLoader<T extends Record<string, unknown>> = () => Promise<
  RouteConfigModule<T>
>

type RouteConfigModule<T extends Record<string, unknown>> = {
  default?: T
  config?: T
} & Record<string, unknown>
```

### Module loaders

```ts
type PageLoader = () => Promise<PageModule>
type LayoutLoader = () => Promise<LayoutModule>
type ErrorLoader = () => Promise<ErrorModule>
type NotFoundLoader = () => Promise<NotFoundModule>

type PageModule = Kiru.Component<any> | PageModuleObject
type LayoutModule = RoutableModule<Kiru.Component<any>> // default + optional interceptors
type ErrorModule = RoutableModule<ErrorPage> // receives { error: Error }
type NotFoundModule = LayoutModule
```

See **Page modules** above for `PageModuleObject`. `resolveRouteConfig(mod)` reads `default` or `config` from config modules.

### Layer inputs

```ts
type RouteHeadMetaInput =
  | RouteHeadMeta
  | ((inherited: RouteHeadMeta) => RouteHeadMeta)

type RouteMetaInput = Partial<RouteMeta> | ((inherited: RouteMeta) => RouteMeta)

type RouteMiddlewareInput =
  | RouteMiddleware
  | RouteMiddleware[]
  | RouteMiddlewareLayer

type RouteMiddlewareLayer = (inherited: RouteMiddleware[]) => RouteMiddleware[]
```

Augment `RouteMeta` for typed app metadata. See [middleware.md](./middleware.md) for `RouteMiddleware` and [head-seo-and-sitemap.md](./head-seo-and-sitemap.md) for `RouteHeadMeta`.

### Path typing

```ts
/** Augment for typed Link / navigate / useParams. */
interface RouteTree {
  routes: /* union of logical paths */
}

type AppRoutePath = /* union from RouteTree.routes, or never when unconfigured */
type RouteParams<P extends string> = /* inferred from [param] segments in P */
type ParamsForPath<P extends AppRoutePath> = RouteParams<P>
```

### Build-time path expansion (page module co-exports)

```ts
type GenerateStaticParamsContext = {
  params: Record<string, string>
}

type GenerateStaticParams = (
  ctx: GenerateStaticParamsContext
) => Promise<Array<Record<string, string>>> | Array<Record<string, string>>

type GenerateSitemapParams = GenerateStaticParams
```

### Manifest & matching

```ts
import {
  compileRouteTree,
  matchRoute,
  generateStaticPaths,
  generatePublicStaticPaths,
  generateSitemapPaths,
} from "kiru/router"

function compileRouteTree(tree: RouteTreeDefinition): RouteManifest

function matchRoute(
  manifest: RouteManifest,
  pathname: string,
  pathPolicy?: RouterPathPolicy
): RouteMatch | null

type RouteManifest = {
  routes: CompiledRoute[]
  rootHasNotFound?: boolean
  rootLayout?: LayoutLoader
  rootError?: ErrorLoader
}

type CompiledRoute = {
  id: string
  method: "GET"
  path: string
  pattern: RegExp
  segments: string[]
  score: number
  params: string[]
  static: boolean
  component: PageLoader
  config?: RouteConfigLoader<RoutePageConfig>
  scopes: CompiledRouteScope[]
  head: RouteHeadMeta
  meta: RouteMeta
  middleware: RouteMiddleware[]
  error?: ErrorLoader
}

type CompiledRouteScope = {
  id: string
  static: boolean
  layout?: LayoutLoader
  notFound?: NotFoundLoader
  config?: RouteConfigLoader<RouteScopeConfig>
  head: RouteHeadMeta
  meta: RouteMeta
  middleware: RouteMiddleware[]
  error?: ErrorLoader
}

type RouteMatch = {
  route: CompiledRoute
  params: Record<string, string>
  pathname: string
}

type RouterPathPolicy = {
  baseUrl?: string
  trailingSlash?: "always" | "never"
}
```

See [navigation-and-guards.md](./navigation-and-guards.md) for path policy usage with `Link` and `navigate`.

# Route tree and matching

The route tree is the **authoring-time** structure; `compileRouteTree` produces a **RouteManifest** used everywhere (match, prerender, sitemap, renderer, client router).

---

## Node kinds

### Scope (`kind: "scope"`)

- Optional `layout`, `notFound`, `error`
- `middleware`, `meta`, `head` (layered — see below)
- `static?: boolean` — applies to descendant leaves unless overridden
- `children: RouteNodeDefinition[]`

Authoring helpers: `createRouteScope`, `createRouteTree({ layout, children })`.

### Route (`kind: "route"`)

- `path` — pattern with `[param]` or `[...rest]` segments
- `component: RouteLoader` — dynamic `import()` or function returning module
- Optional `static`, `head`, `meta`, `middleware`, `error`

Shorthand: `createRoute("/path", () => import("./page"))`.

---

## Compilation

`compileRouteTree` (`manifest.ts`) produces:

| Field | Meaning |
|-------|---------|
| `routes: CompiledRoute[]` | Flattened leaves with `pattern`, `score`, `params` |
| `rootLayout` | Root scope layout loader |
| `rootError` | Root scope error boundary |
| `rootHasNotFound` | Whether root defines `notFound` (SSG `404.html`) |

Each `CompiledRoute` includes:

- `scopes[]` — ancestors outer → inner (layout chain)
- Resolved `head`, `meta`, `middleware[]`
- `static: boolean` — prerender eligibility

**Matching:** `matchRoute(manifest, pathname, pathPolicy)` — highest score wins; `pathPolicy` strips `baseUrl` and normalizes trailing slashes.

---

## Page module shape

```typescript
// Typical page.tsx
import { serverLoader } from "kiru/router"

const load = serverLoader({ load: async (ctx) => ({ ... }), fallback: () => <p>…</p> })

export { load }  // or export const load
export default function Page(props: PageProps<typeof load>) { ... }

// Optional co-exports:
export const head = ...
export const validation = ...
export const isr = defineISR({ ... })
export async function generateStaticParams() { ... }
export async function generateSitemapParams() { ... }
```

`RouteModule` = `{ default: Component }` or bare `Component`.

`resolveSsrRouteModule` / page codegen unwrap default exports and linked `.actions.ts` modules.

---

## Static path generation

`generateStaticPaths(manifest, pathPolicy)`:

1. Collect leaves with `static: true`.
2. For dynamic segments, require `generateStaticParams` on the **page module** (not `routes.ts`).
3. Nested static parents compose params — child must not repeat parent keys (enforced; errors cite route path).

`generateSitemapPaths(manifest, siteConfig)` — merges:

- All static paths
- Optional `defaultSsrPaths` (non-static leaves)
- `site.sitemap.include` dynamic routes (must export `generateSitemapParams`)

---

## Typed routes (`AppRoutePath`)

Augment route registry for typed `Link` / `navigate` / `useParams`:

```typescript
// routes.ts — registerPaths or codegen emits this
declare module "kiru/router" {
  interface RoutePaths {
    "/": {}
    "/users/[id]": { id: string }
  }
}
```

Implementation: `packages/lib/src/router/routePaths.ts` — `ParamsForPath`, `Link` href resolution.

File-based routes codegen populates the registry from filesystem paths.

---

## Path policy

`RouterPathPolicy`:

| Field | Effect |
|-------|--------|
| `baseUrl` | e.g. `/app` — stripped before match, added on `Link` |
| `trailingSlash` | `always` \| `never` — matching + prerender file names |

`pathnameForMatch` / `formatPathname` centralize normalization.

---

## Layout rendering

`loadRouteTree` / `buildRoutedSubtree` (`routeTree.ts`):

- Walks scope chain → nested layout components
- Leaf receives `PageProps` (loader data, errors, validation)
- `notFound` when no match (if configured)
- `error` route modules receive `{ error: Error }`

SSR uses same tree builder as client `buildClientOutletSubtree`.

---

## File-based routes

`@kirujs/file-routes` maps:

| File | Role | Configurable via `router.fileRoutes` |
|------|------|--------------------------------------|
| `page.tsx` / `index.tsx` (default) | Route component | `pageFiles` |
| `layout.tsx` (default) | Scope layout | `layoutFiles` |
| `error.tsx` (default) | Error boundary | `errorFiles` |
| `not-found.tsx` (default) | Scope or root notFound | `notFoundFiles` |
| `middleware.ts` | `default` or `middleware` export | — (fixed name) |
| `page.config.ts` | `RoutePageConfig` (static, head, meta) | — |
| `(group)/` | Route group — omitted from URL | — |
| `[slug]` | Dynamic segment | — |
| `[...slug]` | Rest segment | — |

Defaults match the filenames above. Example for `_layout.tsx` / `404.tsx`:

```typescript
fileRoutes: {
  layoutFiles: ["_layout.{tsx,ts,jsx,js,mdx}"],
  notFoundFiles: ["404.{tsx,ts,jsx,js,mdx}"],
}
```

Leading-underscore **directories** (e.g. `_components/`) remain private and are not scanned.

Output: `routes.gen.ts` — import in app and pass to Vite `router.ssg.routes` or manual `routes.ts` re-export.

**E2E:** `e2e/file-routes` (CSR), `e2e/file-routes-ssr`, `e2e/file-routes-ssg` — see [15-testing.md](./15-testing.md).

---

## `createRouteTree` vs manifest

Apps can pass either to `createRouter` / `createRenderer`:

```typescript
createRouter({ routes: routeTreeDefinition })
createRouter({ routes: compileRouteTree(routeTreeDefinition) }) // skip recompile
```

Prerender and adapters may cache compiled manifest for performance.

---

## Not found and errors

| Scenario | Behavior |
|----------|----------|
| No match + nearest scope `notFound` | `loadNotFoundRouteTree` — walks scopes for pathname (not only root) |
| No match + root `notFound` | Render notFound tree (404 status on SSR); SSG emits **`404.html`** only for **root** `notFound` |
| No match + no notFound | Renderer returns null / adapter 404 |
| Throw in page | Nearest `error` module on scope/leaf |
| Throw in root with layout | `rootError` + `rootLayout` if configured |

**Static hosting:** Scope `notFound` works in the client and on SSR; build-time SSG does not emit per-scope `404.html` today. How CDN preview and deploy hosts resolve unknown URLs (`exact` vs SPA shell vs hybrid SSR) is documented in [19-static-404-and-host-fallback-strategies.md](./19-static-404-and-host-fallback-strategies.md).

Tests in `router.test.tsx` cover root error without layout (when that suite runs — see [15-testing.md](./15-testing.md)).

---

## Further reading

- [05-middleware-and-navigation-guards.md](./05-middleware-and-navigation-guards.md)
- [06-loaders-and-data.md](./06-loaders-and-data.md)
- [13-vite-plugin-and-build-pipeline.md](./13-vite-plugin-and-build-pipeline.md)
- [19-static-404-and-host-fallback-strategies.md](./19-static-404-and-host-fallback-strategies.md)

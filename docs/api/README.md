# Kiru router & rendering — public API reference

Kiru is a full-stack application framework built on the Kiru signal renderer. It provides nested route trees, four loader kinds, route middleware, streaming SSR, static prerender (SSG), hybrid ISR, internationalized routing, remote functions, interceptors, and Vite-first tooling. This directory is the **author-facing API reference** — behavioral contracts, types, and examples for every public surface.

For architecture notes and internal design, see [docs/v2](../v2/README.md).

---

## Rendering modes

| Mode | Client entry | Server | First paint | Client navigation |
|------|--------------|--------|-------------|-------------------|
| **CSR** | `createRouterApp` from `kiru/router/csr` | None | Empty shell + client mount | Full client routing |
| **SSR** | `createRouterApp` from `kiru/router/ssr` | `createRenderer` + adapter | Server HTML + hydrate | Client routing with loader RPC |
| **SSG** | `createRouterApp` from `kiru/router/ssg` | Optional (hybrid) | Prerendered HTML + static hydrate | Client routing from static payload |
| **Hybrid** | Same as SSR | SSG prerender + SSR server | Static routes inlined; dynamic routes SSR | Mixed static + dynamic |

Pick exactly **one** client bootstrap entry per app. The Vite plugin sets a compile-time bootstrap flag (`csr`, `ssr`, or `ssg`) that tree-shakes unused code paths.

---

## Import cheat sheet

| Task | Import from |
|------|-------------|
| Routes, loaders, `Link`, guards, interceptors | `kiru/router` |
| Mount SPA | `kiru/router/csr` |
| Hydrate SSR document | `kiru/router/ssr` |
| Hydrate SSG document | `kiru/router/ssg` |
| Low-level hydrate | `kiru/ssr/router` |
| Define `query` / `mutation` | `kiru/remote` in `*.remote.ts` |
| Consume query in UI | `resource()` from `kiru` |
| Vite integration | `vite-plugin-kiru` |
| File-route codegen (tooling) | `@kirujs/file-routes` |
| Node HTTP server | `@kirujs/adapter-node` |
| Server renderer | `createRenderer` from `kiru/router` |

On the browser, `kiru/router` resolves to a smaller client subset. Server-only APIs (`createRenderer`, `prerenderStaticRoutes`, `runPageLoad`, etc.) are available when bundling for Node, Bun, or Workers.

---

## Component render shape

Kiru components return **JSX directly** or a **render function** `() => JSX`. Choose based on whether setup creates reactive state:

- **Direct JSX** — no `signal`, `resource`, `effect`, hooks like `useRouter`, `useRequestContext`, or `useI18n` in the template.
- **`return () => JSX`** — any reactive setup whose values appear in the output.

```tsx
// Stateless — direct JSX
export default function AboutPage() {
  return <main><h1>About</h1></main>
}

// Reactive — render function
export default function FeedPage() {
  const router = useRouter()
  return () => (
    <main>
      <p>Current path: {router.pathname.value}</p>
    </main>
  )
}
```

Pages with loaders typically use `PageProps<typeof load>` and a render function when displaying loader data reactively.

---

## Validation

Loaders, remotes, and search params use [Standard Schema](https://github.com/standard-schema/standard-schema) validators. Import schema helpers from `kiru/router`:

```ts
import { parseInput, type Schema, type InferSchemaOutput } from "kiru/router"
```

`validationInvalid` surfaces structured validation errors in loader results.

---

## Error handling

| Mechanism | Import | When |
|-----------|--------|------|
| Route error page | `error` on scope/route or `error.tsx` (FBR) | Uncaught render errors in a scope |
| Loader error prop | `PageProps<typeof load>.error` | Loader threw or validation failed |
| Middleware HTTP error | `RouteMiddlewareHttpError` | Middleware returned `{ error: status }` |
| Component boundary | `ErrorBoundary` from `kiru` | Any component subtree |

---

## Types

Type shapes for the public API live in each topic page's **API reference** section. Route-tree authoring types (`createRoute`, `createRouteScope`, `RouteManifest`, path typing, etc.) are canonical in [routes-and-scopes.md](./routes-and-scopes.md). Cross-cutting types (`CustomRequestContext`, `InternationalizationConfig`, `RouterQuery`) are defined on the page that owns the feature and linked from other docs.

---

## Reference pages

| Topic | Document |
|-------|----------|
| Bootstrap & rendering modes | [bootstrap-and-rendering.md](./bootstrap-and-rendering.md) |
| Route trees & scopes (manual) | [routes-and-scopes.md](./routes-and-scopes.md) |
| File-based routes | [file-based-routes.md](./file-based-routes.md) |
| Route middleware | [middleware.md](./middleware.md) |
| Loaders & page data | [loaders-and-page-data.md](./loaders-and-page-data.md) |
| Navigation & guards | [navigation-and-guards.md](./navigation-and-guards.md) |
| Route interceptors | [interceptors.md](./interceptors.md) |
| Remote functions (`query`, `mutation`) | [remote-functions.md](./remote-functions.md) |
| Request context | [request-context.md](./request-context.md) |
| Head, SEO & sitemap | [head-seo-and-sitemap.md](./head-seo-and-sitemap.md) |
| Internationalization | [i18n.md](./i18n.md) |
| ISR & revalidation | [isr-and-revalidation.md](./isr-and-revalidation.md) |
| Vite plugin | [vite-plugin.md](./vite-plugin.md) |
| Server rendering & adapters | [server-rendering-and-adapters.md](./server-rendering-and-adapters.md) |

# Branch overview — changes since `main`

This branch replaces the experimental **FileRouter** / Vike-style file routing with a **declarative route tree**, adds **loaders**, **route middleware**, **runtime adapters**, and ships **Tier 3 wave 1** (hybrid ISR, loader caching, i18n, images).

Approximate diff vs `main` merge-base: **533 files**, **+33k / −6k** lines.

## Removed (breaking)

| Removed | Replacement |
|---------|-------------|
| `FileRouter`, `fileRouterController` | `createRouteTree` + `compileRouteTree` → `RouteManifest` |
| `packages/lib/src/router/link.ts` (old) | `Link`, `navigate` from `kiru/router` (`navigation.ts`) |
| `beforeEach` / `beforeResolve` / `beforeEnter` / `beforeActivate` | `routeMiddleware` + optional `navigationGuards` (component hooks, CSR-only) |
| `pageConfig.ts` | Route `head`, page `load`, `export const isr` |
| Vike renderer files in `sandbox/ssr` (`+onRenderHtml`, etc.) | `routes.ts` + `createRenderer` / `createKiruResponder` |
| `e2e/ssr-bun`, `e2e/ssr-worker` (standalone) | `e2e/ssr-matrix` (13 smoke cells) |
| `virtualManifest` vite-plugin option | Vite `build.manifest` for SSG |
| `validateSearch` / `defineSearchParams`, `KiruValidator`, `assertValid` | `load.validation` with `Schema` + `parseInput` |
| `Link prefetch="hover"` string attribute | `prefetch={ false \| { trigger, chunks, data } }` |

## Added packages / surfaces

| Package | Role |
|---------|------|
| `@kirujs/runtime` | `KiruDeployTarget`, `getRuntimeCapabilities`, ISR guard for edge |
| `@kirujs/adapter-contract` | `KiruHandle` (`Response \| null`), `toFetchHandler`, `composeRespond` |
| `@kirujs/adapter-node` | `createKiruResponder`, `resolveStatic`, Node HTTP bridge |
| `@kirujs/adapter-bun` | `createKiruBunServer`, `serveKiruBun` |
| `@kirujs/adapter-cloudflare` | `createKiruWorkerHandle`, immutable prerender from Assets |

## Router API surface (`kiru/router`)

New or reworked exports (see `packages/lib/src/router/index.ts`):

- **Tree:** `createRouteTree`, `compileRouteTree`, `matchRoute`, `generateStaticPaths`
- **CSR:** `createRouter`, `createRouterApp` (`bootstrap/csr.ts`), `RouterProvider`, `RouterView`, `Link`
- **SSR:** `createRenderer`, `fillRouteHtmlTemplate`, `bootstrapSsrClient`
- **SSG:** `prerenderStaticRoutes`, `bootstrapSsgClient`
- **Loaders:** `loader`, `serverLoader`, `clientLoader`, `staticLoader`, `PageProps`, `usePageData`
- **Policy:** `RouteMiddleware`, `runRouteMiddleware`, `RouteMeta` augmentation
- **Context:** SSR `getRequestContext` + hydration (`RequestContextProvider`, `useRequestContext`)
- **Cache / ISR:** `defineISR`, `revalidatePath`, `revalidateTag`, `diskPrerenderCache`
- **Prefetch / RPC:** `prefetchRoute`, `kiru/router/loaderClient`, `kiru/router/loaderRegistry` (codegen only)
- **i18n:** `createI18nConfig`, `useI18n`, locale routing helpers
- **Site:** `defineSiteConfig`, sitemap/robots generation
- **Images:** `createImageOptimizer`, `createImageOptimizerIfRuntime`

Client bootstrap is split for tree-shaking:

```ts
import { createRouterApp } from "kiru/router/csr"  // SPA
import { createRouterApp } from "kiru/router/ssg"  // static prerender hydrate
import { createRouterApp } from "kiru/router/ssr"  // SSR hydrate
```

## Vite plugin (`vite-plugin-kiru`)

New `router` options:

- `router.ssg` — build-time prerender
- `router.serverEntry` — SSR dev middleware + `dist/server` bundle
- `router.remote` — `*.actions.ts` stub + server registry
- `router.adapter` — `node` \| `bun` \| `cloudflare`
- `router.images` — build-time image variants
- `router.htmlTemplate` / `htmlShell`

## E2E and sandbox

| Fixture | Demonstrates |
|---------|----------------|
| `e2e/csr` | SPA, loaders, i18n, images, middleware redirect |
| `e2e/ssg` | Prerender, staticLoader bake, i18n |
| `e2e/ssr` | SSR, hybrid `/docs`, ISR/PPR, actions, serverLoader, streaming, concurrent request-context isolation |
| `e2e/ssr-matrix` | Same SSR app behind Node/Bun × fetch/Hono/Express/Fastify/Elysia + Workers |
| `sandbox/ssr` | Human-friendly SSR + hybrid docs route |

## Commit themes (for archaeology)

Not exhaustive — use `git log cabe32db..HEAD` for full history:

1. Yeet FileRouter / old SSG plugin paths
2. Single-pass SSR render, form actions, remote functions
3. Hybrid SSR+SSG, error pages, request context on prerender
4. Page loaders (`loader` / `serverLoader` / `staticLoader`)
5. Sitemap expansion, `maxConcurrentRenders` for SSG
6. Speculative deferrals / streaming shell
7. `action.get` / `action.post` split, head + server loaders refactor
8. Runtime adapters + SSR matrix
9. Tier 3 wave 1 (ISR, loader cache, i18n, Image)
10. `staticLoader` prebake into JS modules (not only HTML)
11. Route middleware (replaces nav guard zoo)
12. Abortable navigation/render (`LoaderContext.signal`, SSR action scope, Node disconnect abort)

## Known limitations (ship blockers for docs)

From `CHANGELOG.md` and `devWarnings.ts`:

- `serverLoader` on client navigations needs SSR + `/?loader=` RPC (`__kiru_loaders`)
- Remote `action` (including `action.post({ type: "form" }, …)`) require SSR + `actions.secret`
- `staticLoader` does not run on client navigations (first paint / prerender only)
- Cloudflare Workers: no time-based ISR; immutable prerender + `force-dynamic` only
- Do not mount SSR/SSG HTML with `kiru/router/csr` — use `ssr` or `ssg` bootstrap

# Kiru v2 router — internal documentation

Deep-dive knowledge base for the v2 router work on this branch (diverged from `main`). Use this when onboarding, writing the public docs site, or debugging behavior across CSR / SSG / SSR / hybrid.

**Scope:** ~530 files changed since merge-base with `main` — FileRouter removed, declarative `createRouteTree`, unified loaders, route middleware, runtime adapters, Tier 3 wave 1 (ISR, loader cache, i18n, images).

## How to read these docs

| Doc | Contents |
|-----|----------|
| [00-branch-overview.md](./00-branch-overview.md) | What changed vs `main`, breaking removals, package map |
| [01-architecture.md](./01-architecture.md) | Mental model, request lifecycle, module layout |
| [02-route-tree.md](./02-route-tree.md) | `createRouteTree`, scopes, matching, `static`, path patterns |
| [03-loaders-and-data.md](./03-loaders-and-data.md) | `loader`, `serverLoader`, `clientLoader`, `staticLoader`, validation, cache |
| [04-middleware-meta-context.md](./04-middleware-meta-context.md) | Route middleware, `meta`, `resolveContext`, context gate |
| [05-rendering-modes.md](./05-rendering-modes.md) | CSR / SSG / SSR / hybrid / partial SSG deploy patterns |
| [06-renderer-and-hydration.md](./06-renderer-and-hydration.md) | `createRenderer`, HTML shell, bootstrap imports, hydration |
| [07-isr-prerender-cache.md](./07-isr-prerender-cache.md) | `defineISR`, disk cache, revalidation, PPR-lite |
| [08-i18n.md](./08-i18n.md) | Locale prefixes, `useI18n`, sitemap hreflang |
| [09-actions-and-remote.md](./09-actions-and-remote.md) | `action.post`, `formAction`, remote registry, invalidation |
| [10-vite-plugin-build.md](./10-vite-plugin-build.md) | `vite-plugin-kiru` options, build/preview pipelines |
| [11-adapters-deploy.md](./11-adapters-deploy.md) | Node / Bun / Cloudflare, `Response \| null`, capabilities |
| [12-head-seo-sitemap-images.md](./12-head-seo-sitemap-images.md) | `head`, `defineSiteConfig`, `Image`, fonts |
| [13-e2e-fixtures-reference.md](./13-e2e-fixtures-reference.md) | Catalog of `e2e/*` examples for docs copy-paste |
| [14-migration-from-main.md](./14-migration-from-main.md) | FileRouter → route tree, API mapping checklist |

## Related specs (pre-v2 folder)

These were written during implementation and remain accurate for detail:

- [docs/router/route-middleware-and-context.md](../router/route-middleware-and-context.md) — design spec (shipped)
- [docs/router/tier-3-wave-1.md](../router/tier-3-wave-1.md) — ISR, loader cache, i18n user guide
- [docs/router/deploy-runtimes.md](../router/deploy-runtimes.md) — adapters + HTTP frameworks
- [docs/router/kiru-image.md](../router/kiru-image.md) — image pipeline
- [docs/router-roadmap/](../router-roadmap/) — phased backlog

## Canonical code locations

| Area | Path |
|------|------|
| Router core | `packages/lib/src/router/` |
| Client hydration | `packages/lib/src/ssr/routerHydrate.ts` |
| Bootstrap entrypoints | `packages/lib/src/router/bootstrap/{csr,ssg,ssr}.ts` |
| Vite plugin | `packages/vite-plugin-kiru/` |
| Adapters | `packages/adapter-{node,bun,cloudflare,contract}/`, `packages/runtime/` |
| E2E fixtures | `e2e/csr`, `e2e/ssg`, `e2e/ssr`, `e2e/ssr-matrix` |
| Sandbox demos | `sandbox/ssr`, `sandbox/csr`, `sandbox/ssg` |

## Four rendering modes (product vocabulary)

```
                    BUILD                    RUNTIME SERVER          CLIENT ENTRY
Pure CSR            (client bundle only)     none                    kiru/router/csr
Pure SSG            router.ssg               none (static host)      kiru/router/ssg
SSR                 router.serverEntry       createRenderer          kiru/router/ssr
SSR + SSG hybrid    router.ssg + serverEntry   createRenderer + disk   kiru/router/ssr
Partial SSG+SPA     router.ssg (no server)     none                    kiru/router/ssg
```

“Partial SSG + SPA” is not a separate Vite flag: some routes have `static: true`, others are client-only after first paint. See [05-rendering-modes.md](./05-rendering-modes.md).

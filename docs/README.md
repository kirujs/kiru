# Kiru documentation

This folder documents **Kiru v2** — the router, rendering modes (CSR / SSR / SSG), data layer (loaders, remote actions), build pipeline (`vite-plugin-kiru`), and deployment story. It is written from **implementation review** against the monorepo source, with the goal of shipping a framework competitive with Next.js, SvelteKit, SolidStart, and Nuxt.

## Start here

| Audience | Read first |
|----------|------------|
| New to Kiru v2 | [v2/README.md](./v2/README.md) |
| Choosing CSR vs SSR vs SSG | [v2/03-rendering-modes.md](./v2/03-rendering-modes.md) |
| Shipping to production | [v2/14-adapters-and-deploy-runtimes.md](./v2/14-adapters-and-deploy-runtimes.md), [v2/16-gaps-risks-and-launch-checklist.md](./v2/16-gaps-risks-and-launch-checklist.md) |
| Auth / forms / mutations | [v2/07-remote-actions.md](./v2/07-remote-actions.md) |
| QA / CI | [v2/15-testing.md](./v2/15-testing.md) |

## v2 topic index

All detailed guides live under **[`docs/v2/`](./v2/)**:

| # | Topic | File |
|---|--------|------|
| 1 | System architecture & request lifecycle | [01-architecture.md](./v2/01-architecture.md) |
| 2 | Competitive positioning | [02-competitive-positioning.md](./v2/02-competitive-positioning.md) |
| 3 | CSR, SSR, SSG modes | [03-rendering-modes.md](./v2/03-rendering-modes.md) |
| 4 | Route tree, matching, typed routes | [04-route-tree-and-matching.md](./v2/04-route-tree-and-matching.md) |
| 5 | Middleware & navigation guards | [05-middleware-and-navigation-guards.md](./v2/05-middleware-and-navigation-guards.md) |
| 6 | Loaders & page data | [06-loaders-and-data.md](./v2/06-loaders-and-data.md) |
| 7 | Remote actions & forms | [07-remote-actions.md](./v2/07-remote-actions.md) |
| 8 | Renderer, streaming SSR | [08-renderer-ssr-and-streaming.md](./v2/08-renderer-ssr-and-streaming.md) |
| 9 | Client bootstrap & hydration | [09-client-bootstrap-and-hydration.md](./v2/09-client-bootstrap-and-hydration.md) |
| 10 | ISR, hybrid prerender, cache | [10-isr-hybrid-and-prerender.md](./v2/10-isr-hybrid-and-prerender.md) |
| 11 | Internationalization | [11-i18n.md](./v2/11-i18n.md) |
| 12 | Head, SEO, sitemap, images | [12-seo-head-sitemap-images.md](./v2/12-seo-head-sitemap-images.md) |
| 13 | Vite plugin & build pipeline | [13-vite-plugin-and-build-pipeline.md](./v2/13-vite-plugin-and-build-pipeline.md) |
| 14 | Adapters & deploy runtimes | [14-adapters-and-deploy-runtimes.md](./v2/14-adapters-and-deploy-runtimes.md) |
| 15 | Testing strategy & coverage gaps | [15-testing.md](./v2/15-testing.md) |
| 16 | Gaps, risks, launch checklist | [16-gaps-risks-and-launch-checklist.md](./v2/16-gaps-risks-and-launch-checklist.md) |
| 17 | Package exports & import guide | [17-package-exports-and-import-guide.md](./v2/17-package-exports-and-import-guide.md) |

## Monorepo map (implementation)

| Package | Role |
|---------|------|
| `packages/lib` (`kiru`) | Router, renderer, loaders, remote actions, hydration |
| `packages/vite-plugin-kiru` | Build modes, SSG prerender, codegen, dev SSR |
| `packages/file-routes` | Filesystem → `routes.gen.ts` |
| `packages/runtime` (`@kirujs/runtime`) | Deploy target capabilities (ISR, FS, edge) |
| `packages/adapter-node` / `adapter-bun` / `adapter-cloudflare` | Production HTTP handlers |
| `packages/adapter-contract` | Shared `KiruHandle` / responder composition |
| `e2e/csr`, `e2e/ssr`, `e2e/ssg`, `e2e/file-routes`, `e2e/ssr-matrix` | Cypress fixtures |

## Conventions in these docs

- **Source of truth** is TypeScript under `packages/lib/src/router/`, `packages/lib/src/ssr/`, `packages/lib/src/remote/`, and `packages/vite-plugin-kiru/`.
- **Known issues** called out explicitly (e.g. CSR middleware `{ error }` behavior) so docs stay honest for launch planning.
- Cross-links use relative paths within `docs/v2/`.

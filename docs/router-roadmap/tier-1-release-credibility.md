# Tier 1 — Release credibility

**Goal:** Remove “preview” uncertainty, close documented footguns, and give adopters a clear path from `create-kiru` → production.

**Exit criteria:** Router is documented on kirujs.dev; hybrid SSR+SSG is reproducible from templates; critical routing/loader edges are tested; at least one official deployment recipe ships.

---

## Documentation & positioning

- [ ] **Router guide on kirujs.dev** — single narrative: route tree, CSR vs SSR vs SSG vs hybrid, loader kinds, actions, head/SEO, deployment
- [ ] **Loader matrix table** — when `serverLoader` / `staticLoader` / `loader` / `clientLoader` run (SSR, SSG, CSR first paint, CSR navigation)
- [ ] **Hydration checklist** — `createRouterApp` vs `RouterView`; streaming vs non-streaming SSR; link to `vite-plugin-kiru` README sections
- [ ] **Hybrid deployment guide** — `prerenderedHtmlDir`, prod vs dev disk behavior, why `vite preview` ≠ hybrid SSR
- [ ] **Remove or soften “preview” label** in root `README.md` when Tier 1 blockers below are done
- [ ] **Migration notes** (lightweight) — from Vue Router / React Router / SvelteKit mental models (not full codemods)

## Scaffolding & DX

- [ ] **Audit `create-kiru` templates** — CSR, SSG, SSR, hybrid each match current `kiru/router/*` bootstrap APIs
- [ ] **Template `routes.ts` examples** — guards, `static: true`, `generateStaticParams`, `site.config.ts`, one `*.actions.ts` page
- [ ] **Example `server.ts`** using `resolveStatic` + `createRenderer` + `prerenderedHtmlDir` for hybrid
- [ ] **Env conventions doc** — `import.meta.env`, what is available in SSR vs client bundles (even if minimal)

## Routing — tests & guarantees

- [ ] **Unit tests: catch-all `[...slug]`** — match, params, `generateStaticParams` path encoding
- [ ] **Unit tests: optional `[[segment]]`** — match with/without segment
- [ ] **Unit tests: `baseUrl` + `trailingSlash` policy** — match, `Link.resolveHref`, sitemap URLs
- [ ] **Unit tests: ambiguous route scoring** — static beats dynamic; document scoring rules in docs
- [ ] **E2E: hybrid prerender + SSR** — extend or document `e2e/ssr/scripts/verify-hybrid-prerender.mjs` as canonical check

## Loaders & hydration — sharp edges

- [ ] **Document CSR + `serverLoader`** — first paint via SSR/SSG only; navigations need `/?loader=` RPC or universal/client loaders
- [ ] **Dev warning: `RouterView` on SSR document** without `k-page-data` / bootstrap (detect in dev)
- [ ] **Dev warning: `serverLoader` invoked in CSR** without loader client (`__kiru_loaders`)
- [ ] **E2E: server loader** — client navigation after SSR hydration refetches or uses serialized data correctly
- [ ] **Clarify `staticLoader` on client** — docs + optional dev warning if `load` is static-only and user navigates in CSR-only app

## Request context (CSR gap)

- [ ] **Document `CustomRequestContext`** — augmentation pattern, SSR injection, CSR limitations today
- [ ] **Spike: `createRouterApp({ context })` or `getContext()`** — wrap `RequestContextProvider` for CSR-only apps (minimal API design; implement in Tier 2 if not here)

## Actions & security

- [ ] **Document remote actions** — `actions.secret`, `allowedOrigins`, token field, form vs JSON `action`
- [ ] **E2E: form action** progressive enhancement + redirect handling
- [ ] **Security section** — CSRF/origin checks, never commit secrets, rotate `actions.secret`

## Build & deploy adapters (Tier 1 minimum)

- [ ] **Official recipe: Node + Hono** — reference `e2e/ssr/src/server.ts`; publish as doc + template
- [ ] **Official recipe: static host (SSG only)** — output layout, `404.html`, `sitemap.xml`, SPA fallback vs per-route HTML
- [ ] **Official recipe: hybrid** — `dist/client` + `dist/server`, env vars, static asset serving
- [ ] **Optional: `adapter-static` helper** — small package or doc script mapping `prerenderStaticRoutes` output to `outDir` structure

## Code quality (focused refactors)

- [ ] **Extract navigation pipeline from `csr.tsx`** — guards + commit + redirect loop into `navigation.ts` (behavior unchanged)
- [ ] **Extract prerender short-circuit from `renderer.ts`** — disk read + hydrate path (behavior unchanged)
- [ ] **Add CHANGELOG / router section** for user-visible router releases

## Release checklist

- [ ] All Tier 1 e2e suites green in CI (`e2e/csr`, `e2e/ssr`, `e2e/ssg`)
- [ ] `packages/lib` router unit tests green including new routing cases
- [ ] Version bump + release notes summarizing router v1 scope and known limitations (link Tier 2 doc)

---

## Dependencies & notes

| Item | Depends on |
|------|------------|
| Remove “preview” | Docs + hybrid guide + catch-all tests |
| CSR `serverLoader` docs | May pair with Tier 2 loader refetch API |
| Adapters | None — can ship as markdown first |

## Explicitly deferred to Tier 2

- Typed search params
- Loader invalidation after `action`
- File-based route generator
- Cloudflare Workers adapter (unless trivial from Node recipe)

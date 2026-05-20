# E2E fixtures — examples catalog for docs

Copy-paste sources for the public docs site. Each fixture is a runnable reference.

## `e2e/csr` — pure client SPA

| Path | File | Demonstrates |
|------|------|--------------|
| `/` | `pages/index.tsx` | Basic render |
| `/about` | `pages/about/` | Static page |
| `/users/[id]` | `pages/users/[id]/` | Dynamic params |
| `/guarded` | `routes.ts` middleware redirect | Inline `middleware: [() => ({ redirect })]` |
| `/navigation` | `pages/navigation/` | Programmatic nav |
| `/slow-target` | `pages/slow-target/` | Async component() delay |
| `/loaders/client` | `pages/loaders/client.tsx` | `clientLoader` |
| `/loaders/universal` | `pages/loaders/universal.tsx` | Universal `loader` |
| `/image-demo` | `pages/image-demo/` | `<Image>` build pipeline |
| `/context/*` | `context/` tree | `resolveContext`, gate, middleware |
| i18n | `i18n.ts`, `cypress/e2e/i18n.cy.ts` | Locale switch, `Link locale` |

**Bootstrap:** `src/main.tsx` → `kiru/router/csr` + `createContextAppOptions`.

**Vite:** `vite.config.ts` — images only, no ssg/serverEntry.

## `e2e/ssg` — static prerender

| Path | Demonstrates |
|------|--------------|
| `/`, `/about`, `/seo` | Static HTML + head/jsonLd |
| `/posts/[slug]` | `generateStaticParams` |
| `/loaders/static` | `staticLoader` + baked payload |
| `/image-demo` | Images in SSG output |
| `/context/*` | Hydrate + client nav to non-static admin |
| i18n | Locale path expansion at build |

**Bootstrap:** `kiru/router/ssg`.

**Vite:** `router.ssg: true`.

**Cypress:** `ssg.cy.ts`, `context.cy.ts`, `i18n.cy.ts`, `image.cy.ts`.

### Context tests worth quoting in docs

From `cypress/e2e/context.cy.ts`:

- Guest on `/context` — no pending UI
- Click admin → redirect `/context/login`
- Slow auth → scope `contextPendingFallback`
- Signed-in → admin loader marker visible

## `e2e/ssr` — server render + hybrid

| Path | Demonstrates |
|------|--------------|
| `/docs` | Hybrid static prerender (disk HTML in prod) |
| `/ppr/force-dynamic` | ISR dynamic override |
| `/ppr/force-static` | force-static 404 behavior |
| `/loaders/server` | `serverLoader` + RPC; Cypress prefetch-on-hover (single `?loader=` for hover + click) |
| `/loaders/server-immediate-shell` | Streaming fallback |
| Form/action specs | `x-kiru-form`, invalidate header |
| Tier 3 | `cypress/e2e/tier3-wave1.cy.ts` |
| `/context-concurrency` | Parallel SSR isolation (`x-e2e-user-name` header) |

**Server:** `src/server.ts` + `createKiruResponder` + `import "virtual:kiru:remote-registry"`.

**Bootstrap:** `kiru/router/ssr`.

**Vite:** `serverEntry` + `ssg` + `remote: "**/*.actions.ts"`.

**Site:** `src/site.config.ts` — sitemap include/exclude lists.

**Scripts:** `scripts/verify-hybrid-prerender.mjs` — canonical hybrid check; `scripts/concurrent-request-context.mjs` — after build, spawns prod `dist/server` on a free port, 32 parallel GETs to `/context-concurrency` with distinct `x-e2e-user-name`, asserts HTML + `k-request-context` + `echoContextUser` RPC (shared logic with `cy.task("concurrentContextCheck")`).

## `e2e/ssr-matrix` — adapter smoke

| Cell prefix | Runtime |
|-------------|---------|
| `node-*` | Node 20+ |
| `bun-*` | Bun |
| `worker-*` | Cloudflare worker dev |

Frameworks: `fetch`, `hono`, `express`, `fastify`, `elysia`.

**Fixture routes:** minimal `src/fixture/routes.ts` — hello world SSR.

**Run locally:**

```bash
cd e2e/ssr-matrix
node scripts/matrix.mjs
```

## `sandbox/ssr` — human demo app

Richer than E2E for screenshots and prose:

| Route | Feature |
|-------|---------|
| `/` | Home + head |
| `/docs` | `static: true` hybrid slice |
| `/users/[id]` | Dynamic SSR + auth scope |
| `/demo-loader` | `serverLoader` + `usePageData` |
| `/break-ssr` | Error boundary |
| `/break-ssr-leaf` | Leaf error override |

**Files:**

- `src/routes.ts` — tree
- `src/routeMiddleware.ts` — auth middleware sample
- `src/server/index.ts` — adapter

## `sandbox/csr` / `sandbox/ssg`

Scaffolding-aligned smaller demos (if present in branch) — point readers to `packages/create-kiru` templates.

## Cypress patterns for docs

### Wait for hydration (SSG)

```ts
cy.window().its("__kiruHydratedAt", { timeout: 10000 }).should("be.a", "number")
```

### E2E auth hook (context demos)

```ts
cy.visit("/context", {
  onBeforeLoad(win) {
    win.__E2E_AUTH__ = "user"
    win.sessionStorage.setItem("kiru-e2e-auth", "user")
  },
})
```

Implementation: `e2e/csr/src/context/e2eAuth.ts`.

## Unit tests (secondary references)

| Area | Test file |
|------|-----------|
| Routing | `manifest-routing.test.ts` |
| Middleware | `routeMiddleware.test.ts` |
| Context gate | `contextGate.test.ts` |
| ISR | `routeRevalidate.test.ts`, `rendererPprDynamic.test.ts` |
| Loader cache | `loaderStale.test.ts` |
| i18n | `i18n.test.ts` |
| Bootstrap | `routerBootstrap.test.ts` |
| Prerender HTML | `prerenderedHtml.test.ts` |

Link from public docs as “implementation tests” for contributors.

## Suggested docs site structure mapped to fixtures

| Public doc page | Primary fixture |
|-----------------|-----------------|
| Quickstart CSR | `e2e/csr` |
| Deploy static site | `e2e/ssg` |
| Deploy Node SSR | `e2e/ssr` + `sandbox/ssr` |
| Auth middleware | `e2e/csr/context` |
| Hybrid ISR | `e2e/ssr` `/docs`, tier3 cypress |
| i18n | `e2e/csr` + `e2e/ssg` i18n tests |
| Images | `e2e/csr` image-demo |
| Adapters | `e2e/ssr-matrix` |

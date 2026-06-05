# Competitive positioning

How Kiru v2 compares to **Next.js (App Router)**, **SvelteKit**, **SolidStart**, and **Nuxt** for teams evaluating a production framework — based on implemented features in this monorepo, not marketing claims.

---

## Summary verdict

| Framework | Kiru v2 relationship |
|-----------|---------------------|
| **Next.js** | Competes on **loaders + mutations + hybrid static/SSR** for teams that want a smaller client and signal-based UI. Does **not** compete on RSC, Vercel-native platform features, or ecosystem size. |
| **SvelteKit** | **Closest mental model** (load functions, form actions, adapters). Kiru must match **adapter clarity** and **consistent middleware behavior** on client vs server to feel as dependable. |
| **SolidStart** | Similar niche (fine-grained reactivity + SSR). Kiru’s explicit loader kinds and ISR are competitive if hydration and navigation parity are proven. |
| **Nuxt** | Nuxt wins **modules, conventions, auto-imports, deploy breadth**. Kiru wins **control and a single renderer** for custom apps that do not want Vue/Nitro assumptions. |

---

## Feature matrix (implemented today)

| Capability | Kiru v2 | Next.js App Router | SvelteKit | SolidStart | Nuxt |
|------------|---------|-------------------|-----------|------------|------|
| File-based routing | ✅ `@kirujs/file-routes` | ✅ | ✅ | ✅ | ✅ |
| Nested layouts | ✅ scopes | ✅ | ✅ | ✅ | ✅ |
| Server data on first paint | ✅ loaders | ✅ RSC/loaders | ✅ `+page.server` | ✅ server$ | ✅ asyncData |
| Client navigations w/ data | ✅ loader RPC / cache | ✅ | ✅ | ✅ | ✅ |
| Form mutations | ✅ remote actions | ✅ Server Actions | ✅ form actions | ✅ server actions | ✅ (modules) |
| Streaming HTML | ✅ `stream: true` | ✅ | ✅ | ✅ | ✅ |
| Static generation | ✅ SSG prerender | ✅ | ✅ prerender | ✅ | ✅ |
| Time-based revalidation | ✅ Node/Bun ISR | ✅ | ✅ (adapter-dependent) | Partial | ✅ |
| Edge without ISR | ✅ CF immutable static | ✅ limited | ✅ | ✅ | ✅ Nitro |
| Typed links | ✅ `AppRoutePath` augment | ✅ | ✅ | ✅ | ✅ |
| Global middleware file | ❌ tree only | ✅ `middleware.ts` | ✅ `hooks.server` | ✅ | ✅ `middleware/` |
| API routes / REST handlers | ❌ multiplexed `?action` / `?loader` | ✅ Route Handlers | ✅ `+server` | ✅ | ✅ server/api |
| React Server Components | ❌ | ✅ | N/A | N/A | N/A |
| Content / MDX layer | ❌ built-in | ✅ ecosystem | ✅ | Partial | ✅ @nuxt/content |
| Image pipeline | ❌ removed v2.0 (ADR v2.1+) | ✅ `next/image` | ✅ `@sveltejs/enhanced-img` | Partial | ✅ `@nuxt/image` |
| i18n routing | ✅ built-in router | ✅ ecosystem | ✅ ecosystem | Partial | ✅ @nuxtjs/i18n |
| Route-tree `modulepreload` (hydration / Link hover) | ✅ v2.0 | Partial (bundler heuristics) | ✅ | Partial | Partial |
| View Transitions | ✅ router option | Partial | ✅ | ✅ | Via Vue |
| DevTools | ✅ kiru devtools | ✅ | ✅ | Partial | ✅ |

---

## Where Kiru is strong

### 1. Unified route tree across modes

One `RouteManifest` drives CSR, SSR, SSG, sitemap generation, and ISR path sets. Competitors often split mental models (e.g. “pages router” vs “app router”). Kiru avoids that split.

### 2. Loader taxonomy

Four explicit kinds — `server`, `static`, `universal`, `client` — with compile-time dev warnings when used in the wrong bootstrap bundle. This is **more explicit** than a single `load` export with implicit environment behavior.

### 3. Hybrid ISR (Node/Bun)

`defineISR`, disk prerender cache, `revalidatePath`, `revalidateTag`, and production serve-static-before-SSR mirror what teams want from Next’s static + revalidate story — on **your** server, not a platform lock-in.

### 4. Remote actions + form controller

Codegen registry, passthrough JSON results, `query` / `mutation` / `form` remotes, cookie specs on responses, query-cache patches, and origin checks are **production-oriented** primitives (see [23-remote-functions.md](./23-remote-functions.md)).

### 5. Signal-first rendering

For teams already on Kiru, there is no serialization boundary for UI state like RSC — the model is HTML + hydrate + signals. That can mean **smaller conceptual surface** for apps that are fully client-interactive after load.

### 6. Monorepo proof points

- `e2e/ssr` — large Cypress suite (loaders, streaming, ISR, forms).
- `e2e/ssr-matrix` — same fixture across Bun/Node/Worker adapters.
- `sandbox/ssr` — cookie session auth with real actions.

---

## Where Kiru is weak or different

### 1. No RSC / partial islands

Positioning must be clear: Kiru v2 is **not** “Next with different syntax.” It is **SSR/SSG HTML + client framework**. Teams needing server components for data-heavy trees without client JS should stay on Next or explore Marko/Qwik-class models.

### 2. No first-class HTTP API layer

All server entry points go through the **document renderer** plus query multiplexing:

- `/?action=<id>`
- `/?loader=<routeId>:load`

That is powerful but unfamiliar. BFFs and public APIs often want `/api/v1/...` routes — today you implement those **outside** `createRenderer` or add a separate Hono/Fastify mount (as in `e2e/ssr-matrix`).

### 3. Cloudflare is second-class for caching

Timed ISR, tags, and mutable prerender cache are **disabled** on `cloudflare` deploy target. Workers are supported for SSR + immutable static assets, not for “Next on Workers” parity. Runtime image optimization was removed in v2.0 (see [21-image-pipeline-adr.md](./21-image-pipeline-adr.md)).

### 4. Middleware scope

Only **route-tree middleware** exists — no root `middleware.ts` that runs on every request independent of matched route (Next/SvelteKit pattern). Auth at the edge often wants that hook.

### 5. Ecosystem & hosting recipes

Next/Vercel, SvelteKit adapter-auto, Nuxt Nitro — **deploy stories are one command**. Kiru has adapters but fewer hosted “golden paths” and no Vercel/Netlify first-party packages in-repo.

### 6. CSR/SSR behavioral gaps

Documented in [05-middleware-and-navigation-guards.md](./05-middleware-and-navigation-guards.md) and [16-gaps-risks-and-launch-checklist.md](./16-gaps-risks-and-launch-checklist.md): middleware `{ error }` on CSR does not mirror SSR.

---

## Positioning by team profile

| Team profile | Recommendation |
|--------------|----------------|
| Greenfield SPA + SEO pages | **SSG + CSR hydrate** or hybrid with small SSR surface |
| Auth-heavy dashboard | **SSR** + remote actions + `CustomRequestContext`; plan loader RPC |
| Marketing + blog | **SSG** + `staticLoader` + ISR optional for stale content |
| Edge-only, no Node | **Cloudflare adapter** — immutable prerender + SSR; no timed ISR |
| Migrating from Next App Router | Expect to **rewrite** data layer (no RSC); map Server Actions → remote actions |
| Migrating from SvelteKit | Map `+page.server` → `serverLoader`, `+page.ts` load → `universalLoader`, hooks → route middleware |

---

## Differentiation narrative (honest)

**Pitch:** “Kiru v2 is a batteries-included router and rendering system for signal-based apps: one route tree, typed navigation, loaders, actions, SSR/SSG/hybrid ISR, and adapters — without a platform runtime tax.”

**Do not pitch:** “Drop-in Next replacement” or “full-stack React with server components.”

---

## Further reading

- [16-gaps-risks-and-launch-checklist.md](./16-gaps-risks-and-launch-checklist.md)
- [14-adapters-and-deploy-runtimes.md](./14-adapters-and-deploy-runtimes.md)
- [15-testing.md](./15-testing.md)

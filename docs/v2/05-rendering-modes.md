# Rendering modes — CSR, SSG, SSR, hybrid

Kiru does not use a single `mode: "csr"` env flag. Mode is implied by **Vite plugin options**, **deploy target**, and **`createRouterApp` import path**.

## Mode matrix

| Mode | `vite.config` | Production host | Client entry |
|------|---------------|-----------------|--------------|
| **Pure CSR** | default (no `ssg` / `serverEntry`) | Static CDN + SPA fallback to `index.html` | `kiru/router/csr` |
| **Pure SSG** | `router.ssg: true` | Static CDN; per-path `*.html` | `kiru/router/ssg` |
| **SSR** | `router.serverEntry` | Node/Bun/Worker server | `kiru/router/ssr` |
| **SSR + SSG hybrid** | both `ssg` + `serverEntry` | Server + `dist/client` prerender | `kiru/router/ssr` |
| **Partial SSG + SPA** | `ssg` only, mixed `static` flags | CDN: prerendered paths + SPA fallback for rest | `kiru/router/ssg` |

## Pure CSR

**Config** (`e2e/csr/vite.config.ts`):

```ts
kiru({
  router: { images: { ... } },
})
```

**Entry** (`e2e/csr/src/main.tsx`):

```ts
import { createRouterApp } from "kiru/router/csr"

void createRouterApp({
  routes, // createRouteTree root scope: middleware: [requireAuth]
  container: document.getElementById("app")!,
  i18n,
  resolveContext,
})
```

**Characteristics:**

- Empty `index.html` shell; all routes client-rendered
- `loader`, `clientLoader`, universal `loader` OK
- `serverLoader`, remote `action` **blocked**
- `vite preview`: standard Vite SPA fallback

## Pure SSG

**Config** (`e2e/ssg/vite.config.ts`):

```ts
kiru({ router: { ssg: true } })
```

**Build:** `prerenderStaticRoutes` writes filled HTML for every `generateStaticPaths` URL into `dist/`.

**Entry:**

```ts
import { createRouterApp } from "kiru/router/ssg"
```

**Characteristics:**

- First paint from prerendered HTML + `k-page-data`
- `staticLoader` baked into page modules
- Client navigations work like SPA (`createRouter` after hydrate)
- Non-static routes (no `static: true`) are **not** in `dist` — deep links need **host SPA fallback**, not only `404.html`
- `vite preview`: `createSsgPreviewMiddleware` serves prerender files; unknown paths → `404.html` if present

**Partial static tree example** (`e2e/ssg/src/routes.ts`):

- Large `static: true` scope for marketing
- `...contextRouteChildren(r)` includes `/context/admin` **without** `static: true` — reachable only via client navigation from prerendered `/context`

## SSR

**Config** (`e2e/ssr/vite.config.ts`):

```ts
kiru({
  router: {
    serverEntry: "./src/server.ts",
    remote: "**/*.actions.ts",
  },
})
```

**Server** (`sandbox/ssr/src/server/index.ts` pattern):

```ts
import { createKiruResponder } from "@kirujs/adapter-node"

const kiru = createKiruResponder({
  importMetaUrl: import.meta.url,
  routes, // root scope middleware: [requireAuth]
  stream: true,
  actions: { secret: process.env.KIRU_ACTIONS_SECRET! },
})
export default { fetch: kiru.fetch }
```

**Client:**

```ts
import { createRouterApp } from "kiru/router/ssr"
```

**Dev:** Plugin SSR middleware loads `serverEntry` via `ssrLoadModule` — no separate `@hono/vite-dev-server` required.

**Characteristics:**

- Every request can be rendered on server
- `serverLoader` RPC on client navigations
- Remote actions + `formAction` with `actions.secret`
- `vite preview` proxies unknown paths to `dist/server` child process

## SSR + SSG hybrid

**Same vite config as SSR** plus `router.ssg: true`.

**Static route example** (`sandbox/ssr/src/routes.ts`):

```ts
createRoute("/docs", {
  static: true,
  component: () => import("./pages/docs.tsx"),
}),
```

**Production flow:**

1. Build prerenders `/docs` → `dist/client/docs/...html`
2. Server `createRenderer({ prerenderedHtmlDir: clientDir })` serves disk when path ∈ `generateStaticPaths` and ISR allows
3. Miss or `defineISR({ dynamic: "force-dynamic" })` → live SSR

**Dev:** Disk prerender **never** read — static routes still SSR live (avoids stale HTML).

**`vite preview`:** Serves filled prerender only; other paths proxy to SSR bundle (`requireFilledHtml: true`).

## Choosing loaders per mode

| Need | CSR | SSG | SSR |
|------|-----|-----|-----|
| Public CMS content at build | `staticLoader` | ✓ | optional |
| Per-user HTML | — | — | `serverLoader` + context |
| Client-only API | `clientLoader` | rare | `clientLoader` after hydrate |
| SEO + personalization | — | static shell + CSR island | hybrid or full SSR |

## Bootstrap mode marker

`markRouterBootstrap("csr" | "ssg" | "ssr")` sets `globalThis.__kiru_routerBootstrap` for dev warnings in `devWarnings.ts`.

## Common deploy mistakes (docs fodder)

| Mistake | Symptom |
|---------|---------|
| Serve hybrid `index.html` shell for all URLs | Empty `{{kiru_body}}` pages |
| Use `kiru/router/csr` on SSR output | Hydration warning; missing loader data |
| Expect `staticLoader` after client nav | Stale or empty data |
| Rely on prerender disk in dev | “ISR broken” — dev always SSR when `serverEntry` set |
| Cloudflare + time-based ISR | Build warning; use immutable prerender only |

## ASCII: hybrid request routing (production)

```
GET /docs
  → tryServePrerenderedFromDisk ✓
  → return cached HTML (+ optional SWR regen)

GET /users/1
  → disk miss or force-dynamic
  → prepareAppForUrl (SSR)
  → HTML + hydrate scripts

GET /assets/app.js
  → adapter static file middleware (before renderer)
```

See [07-isr-prerender-cache.md](./07-isr-prerender-cache.md) for ISR details.

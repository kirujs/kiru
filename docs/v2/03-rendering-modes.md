# Rendering modes: CSR, SSR, and SSG

Kiru v2 treats **CSR**, **SSR**, and **SSG** as first-class build targets with separate client entry points and compile-time guards — not as runtime flags inside one fat client bundle.

---

## Mode overview

| Mode | First paint | Subsequent navigation | Server required |
|------|-------------|----------------------|-----------------|
| **CSR** | Empty shell + client bundle | Full client router | No (static hosting) |
| **SSR** | HTML from `createRenderer` | Client router + loader RPC | Yes |
| **SSG** | Prebuilt HTML per URL | Client router (static hydrate) | Optional (hybrid) |
| **Hybrid** | Static URL → disk HTML; else SSR | Same as SSR client | Yes |

---

## Compile-time: `__KIRU_ROUTER_BOOTSTRAP__`

`vite-plugin-kiru` sets a Vite `define` on **client** builds (`packages/vite-plugin-kiru/src/index.ts`):

```typescript
function resolveRouterBootstrapDefine(opts: KiruPluginOptions): "csr" | "ssr" | "ssg" {
  if (opts.router?.serverEntry) return "ssr"   // hybrid still uses ssr client when serverEntry exists
  if (opts.router?.ssg) return "ssg"
  return "csr"
}
```

Consumed in `packages/lib/src/env.ts`:

- `__KIRU_PURE_CLIENT__` — `csr` or `ssg`
- `__KIRU_SSR__` — `ssr`

**Implication:** Hybrid apps (SSG prerender + SSR server) ship an **SSR client bundle** (`__KIRU_SSR__`), not an `ssg` client bundle, because `serverEntry` wins in `resolveRouterBootstrapDefine`.

---

## Client entry points (use exactly one per app)

| Import | Use when |
|--------|----------|
| `createRouterApp` from `kiru/router/csr` | Pure SPA |
| `createRouterApp` from `kiru/router/ssr` | SSR or hybrid |
| `createRouterApp` from `kiru/router/ssg` | Pure static host (no server) |
| `bootstrapSsrClient` / `bootstrapSsgClient` from `kiru/ssr/router` | Custom mount/hydrate control |

### CSR (`packages/lib/src/router/bootstrap/csr.ts`)

```typescript
// Typical main.tsx
import { createRouterApp } from "kiru/router/csr"
import { routes } from "./routes"

await createRouterApp({
  routes,
  container: document.getElementById("app")!,
})
```

Mounts `RouterProvider` + `RouterView`. Uses `window.history`. No serialized page data on first paint unless you embed it yourself.

**Loaders:** `clientLoader`, `universalLoader`, `staticLoader` (from build-injected payload). **`serverLoader` is not supported** — dev warns and RPC fails.

### SSR (`packages/lib/src/router/bootstrap/ssr.ts`)

Delegates to `bootstrapSsrClient` with `hydrationMode: "dynamic"`.

**Requires:**

1. Server calling `createRenderer` (or adapter wrapper).
2. HTML template with `{{kiru_head}}` / `{{kiru_body}}` (or `htmlShell`).
3. Serialized scripts: `k-page-data`, `k-request-context`, `k-request-token` (when actions enabled), optional `k-i18n`.

**Loaders:** `serverLoader` uses `POST /?loader=` via `__kiru_loaders.dispatch`.

### SSG (`packages/lib/src/router/bootstrap/ssg.ts`)

Delegates to `bootstrapSsgClient` → same as SSR hydrate but `hydrationMode: "static"`.

**Build:** `vite-plugin-kiru` runs `prerenderStaticRoutes` / plugin SSG pipeline, writes HTML under client output, may inject `__kiruStaticLoaderPayload` into chunks.

**Production:** Static host serves files; client navigates without a server unless you also deploy SSR (hybrid).

---

## Server: `createRenderer`

`packages/lib/src/router/renderer.ts` — `CreateRendererOptions`:

| Option | Effect |
|--------|--------|
| `routes` | Tree or precompiled manifest |
| `htmlTemplate` | Shell with `{{kiru_head}}`, `{{kiru_body}}` |
| `stream` | `ReadableStream<string>` vs buffered string |
| `prerenderedHtmlDir` | Production: serve static HTML for paths in static set **before** SSR |
| `prerenderCache` | ISR storage; defaults with disk dir |
| `actions` | Secret, `allowedOrigins`, action handler |
| `i18n` | Locale detection, message hydration |
| `deployTarget` | `node` \| `bun` \| `cloudflare` — gates ISR/fs |
| `pathPolicy` | `baseUrl`, `trailingSlash` |

**Development:** Disk prerender is **never** read — static routes are SSR’d like dynamic ones so dev reflects latest code.

**Production hybrid flow:**

1. If URL ∈ static path set → try disk/cache HTML.
2. Else SSR (or 404 for `force-static` without file — see [10-isr-hybrid-and-prerender.md](./10-isr-hybrid-and-prerender.md)).

---

## Vite plugin configuration matrix

| `router` option | CSR | SSG-only | SSR | Hybrid (SSG + SSR) |
|-----------------|-----|----------|-----|-------------------|
| `ssg: true` | — | ✅ | — | ✅ |
| `serverEntry` | — | — | ✅ | ✅ |
| `fileRoutes` | optional | optional | optional | optional |
| `adapter: cloudflare` | — | ✅ | ✅ | immutable ISR only |

Example hybrid (`vite.config.ts` concept):

```typescript
kiru({
  router: {
    ssg: { routes: "./src/routes.ts" },
    serverEntry: "./src/server/index.ts",
    adapter: "node",
  },
})
```

`vite build` → prerender static routes → bundle server. Production Node adapter serves prerender first, then SSR.

---

## HTML shell contract

Minimum template:

```html
<!doctype html>
<html lang="{{kiru_locale}}">
  <head>{{kiru_head}}</head>
  <body>
    <div id="app">{{kiru_body}}</div>
    <script type="module" src="/src/client.tsx"></script>
  </body>
</html>
```

`{{kiru_head}}` receives serialized meta, context, page data, i18n, tokens.  
`{{kiru_body}}` receives the rendered route subtree (mount target inner HTML).

For SSG, plugin may emit per-path HTML files (`index.html`, `about/index.html`, or `404.html` for root notFound).

---

## Choosing a mode

| Need | Mode |
|------|------|
| Internal admin behind VPN, SEO irrelevant | CSR |
| SEO + personalized HTML + auth cookies on first paint | SSR |
| Marketing site, all URLs known at build | SSG |
| Docs static + app SSR | Hybrid |
| Global edge, no Node ISR | Cloudflare + immutable SSG + SSR fallback |

---

## Footguns

1. **Using `RouterView` alone after SSR** — does not preload hydrated subtree; use `createRouterApp` from `kiru/router/ssr` (dev warning in `routerView.tsx`).
2. **Hybrid client bundle** — must be SSR bootstrap, not SSG, when `serverEntry` is set.
3. **`serverLoader` in SSG-only client** — wrong bundle; use `staticLoader` or add SSR server.
4. **Hash fragments on SSR** — server renders with `hash: ""`; client stashes/restores hash around hydrate (`routerHydrate.ts`) to avoid mismatch.

---

## Further reading

- [09-client-bootstrap-and-hydration.md](./09-client-bootstrap-and-hydration.md)
- [08-renderer-ssr-and-streaming.md](./08-renderer-ssr-and-streaming.md)
- [10-isr-hybrid-and-prerender.md](./10-isr-hybrid-and-prerender.md)
- [13-vite-plugin-and-build-pipeline.md](./13-vite-plugin-and-build-pipeline.md)

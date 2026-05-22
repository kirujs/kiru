# Adapters and deploy runtimes

Production apps use **adapters** to connect `createRenderer` to a host HTTP stack. Capabilities depend on `@kirujs/runtime` deploy target.

---

## Deploy targets

| Target | ISR timed/tags | Mutable prerender cache | Runtime sharp | FS prerender dir |
|--------|----------------|-------------------------|---------------|------------------|
| `node` | ✅ | ✅ | ✅ | ✅ |
| `bun` | ✅ | ✅ | ✅ | ✅ |
| `cloudflare` | ❌ | ❌ | ❌ | ❌ |

Source: `packages/runtime/src/index.ts`.

---

## `@kirujs/adapter-contract`

Shared types:

- `KiruHandle` — `(request) => Response | null`
- `toFetchHandler` — wrap for Workers/Fetch
- `composeRespond` — middleware chain (static files, logging)

`null` → fall through to next handler (404).

---

## Node (`adapter-node`)

`createKiruHandler` / `createKiruResponder`:

| Option | Purpose |
|--------|---------|
| `importMetaUrl` | Resolve `clientDir` |
| `prerenderedHtmlDir` | Hybrid disk serve (default client dir; `false` to disable) |
| `getRequestContext` | Per-request `CustomRequestContext` |
| `image` | sharp runtime optimizer |
| `serveStaticAssets` | Serve Vite assets before SSR (default prod) |
| `stream` | Pass through to `createRenderer` |

Uses `createRenderer` with `deployTarget: "node"`.

---

## Bun (`adapter-bun`)

Same API surface as Node with `deployTarget: "bun"`.

`e2e/ssr-matrix` includes Bun servers (Hono, Elysia, fetch).

---

## Cloudflare (`adapter-cloudflare`)

`createKiruWorkerHandler` / `createKiruWorkerHandle`:

| Option | Purpose |
|--------|---------|
| `getAsset(pathname)` | Read prerendered HTML from Assets/KV/R2 |
| `assetFetch` | Forward `/assets/*` to Assets binding |
| `htmlTemplate` | Required inline template string |
| `stream` | Streaming SSR |

**No** `prerenderedHtmlDir` on Workers — immutable prerender via `getAsset` only.

`tryServeImmutablePrerender` before SSR.

Build must not use timed ISR/tags (`assertISRAllowed`).

---

## Wiring pattern (any framework)

```typescript
const kiru = createKiruHandler({ routes, importMetaUrl: import.meta.url, ... })

app.all("*", async (req) => {
  const res = await kiru.handle(req)
  return res ?? next()
})
```

Examples: `e2e/ssr-matrix/src/servers/*` — Express, Fastify, Hono, raw fetch, Workers.

---

## Request context

```typescript
getRequestContext(request): CustomRequestContext | Promise<...>
```

Use for auth session, DB user, feature flags — serialized to HTML for hydration.

Refresh after login via action `actionResponse` token refresh.

---

## Static assets

`isStaticAssetPathname` (`runtime`) — skip SSR for `/assets/*` and extensioned files (except `.html`).

Adapters should serve Vite client output before hitting Kiru.

---

## Static 404 and fallback strategies

Kiru’s **router** uses exact matching plus nearest-scope `notFound`. **Hosts** differ: SSG may serve `404.html`, CSR static deploys often use `index.html` with 200, Cloudflare may probe asset candidates, and **hybrid** apps should send unknown paths to SSR instead of static `404.html`.

Recommended deploy strategies (`exact`, `csr-recovery`, `nearest-asset`, `hybrid-ssr`), defaults per adapter, and footguns: **[19-static-404-and-host-fallback-strategies.md](./19-static-404-and-host-fallback-strategies.md)**.

When writing `DEPLOY-CLOUDFLARE.md`, link there for `getAsset` candidate resolution vs Worker-first hybrid SSR.

---

## SSR matrix e2e

`e2e/ssr-matrix` — shared fixture, multiple servers, smoke script `matrix.mjs`.

Validates adapter contract across runtimes — document in onboarding as **supported servers**.

---

## Hosting recommendations

| Host | Adapter | Notes |
|------|---------|-------|
| VPS / Docker | `adapter-node` | Full ISR + disk |
| Bun native | `adapter-bun` | Same |
| Cloudflare Workers | `adapter-cloudflare` | Immutable SSG + SSR; Assets binding |
| Vercel | Bring your own | No first-party package in repo — use Node serverless with `createKiruHandler` or static SSG only |
| Netlify | Static SSG or edge function wrapper | No dedicated adapter |

---

## Wrangler

Plugin may emit `wrangler.toml` snippet (`wranglerSnippet.ts`) — review generated config for `run_worker_first` + Assets.

---

## Further reading

- [10-isr-hybrid-and-prerender.md](./10-isr-hybrid-and-prerender.md)
- [19-static-404-and-host-fallback-strategies.md](./19-static-404-and-host-fallback-strategies.md)
- [02-competitive-positioning.md](./02-competitive-positioning.md)
- [16-gaps-risks-and-launch-checklist.md](./16-gaps-risks-and-launch-checklist.md)

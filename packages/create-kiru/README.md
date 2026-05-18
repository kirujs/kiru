# create-kiru

CLI tool to quickly get started with a new Kiru project.

Templates scaffold modern Kiru app modes (CSR, SSG, SSR) and can consume declarative route trees from `kiru/router`.

**Router / SSG / SSR conventions**

- Use **`Link`** from `kiru/router` in layouts (works for CSR, SSR, and SSG; static prerender omits SPA `click` handlers so links stay crawlable).
- **SEO**: add a `meta` object on scopes and routes (`title`, `description`, `openGraph`, `twitter`, `canonical`, …). Titles/descriptions support `{param}` placeholders for dynamic segments.
- **SSG**: enable `router.ssg: true` in `vite-plugin-kiru` and a single `vite build` prerenders pages into your built `index.html` shell—no separate prerender script. Use template tokens in source `index.html`: `{{kiru_head}}` in `<head>` and `{{kiru_body}}` where app markup should be injected.
- **Client bootstrap:** `createRouterApp` from `kiru/router/csr`, `kiru/router/ssr`, or `kiru/router/ssg` (one import per mode, tree-shakeable). Lower-level: `bootstrapSsrClient` / `bootstrapSsgClient` from `kiru/ssr/router`.
- **SSR**: use `createRenderer` from `kiru/router` and assemble the response with `fillRouteHtmlTemplate(templateHtml, { body, headHtml: document.headHtml })`, using the same `index.html` shape as SSG when possible. Hydrate with `createRouterApp` from `kiru/router/ssr` (not `RouterView` alone—non-streaming SSR does not inject deferred resource payloads).
- **Hybrid (static docs + SSR app)**: enable both `router.ssg` and `router.serverEntry`. Use **`@kirujs/adapter-node`** (`createKiruHandler`) or pass **`prerenderedHtmlDir`** into `createRenderer` on Node/Bun only. **Production** serves build-time HTML for static paths before SSR; **development** never reads prerender disk. **Cloudflare Workers:** immutable prerender only — no time-based ISR; see [`docs/router/deploy-runtimes.md`](../../docs/router/deploy-runtimes.md). HTTP framework examples (Hono, Express, Fastify, Elysia) use `createKiruResponder` + explicit catch-alls — see that guide.

#### interactive setup:

```
npx create-kiru@latest
# or
yarn create kiru
# or
pnpm create kiru
# or
bunx create-kiru
```

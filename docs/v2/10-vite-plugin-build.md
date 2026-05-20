# Vite plugin — build and preview pipelines

`vite-plugin-kiru` (`packages/vite-plugin-kiru/`) connects the route tree to Vite client build, SSG prerender, SSR server bundle, and preview middleware.

## Minimal configs

### CSR

```ts
import kiru from "vite-plugin-kiru"

export default defineConfig({
  plugins: [kiru()],
})
```

### SSG

```ts
kiru({ router: { ssg: true } })
// or
kiru({ router: { ssg: { routes: "./src/routes.ts", siteModule: "./src/site.config.ts" } } })
```

### SSR

```ts
kiru({
  router: {
    serverEntry: "./src/server.ts",
    remote: "**/*.actions.ts",
  },
  ssr: { external: ["kiru"] }, // keep single kiru instance for action registry
})
```

### Hybrid

```ts
kiru({
  router: {
    ssg: true,
    serverEntry: "./src/server.ts",
    adapter: "node", // or bun | cloudflare
  },
})
```

## `router` options reference

| Option | Effect |
|--------|--------|
| `ssg` | Prerender at end of client `closeBundle` |
| `ssg.build.maxConcurrentRenders` | Parallelism (default 10; `Infinity` = all paths at once) |
| `serverEntry` | SSR dev middleware + `dist/server` bundle; sets `appType: "mpa"` on client build |
| `adapter` | Target platform + ISR compatibility warnings |
| `remote` | Glob → client stubs + `virtual:kiru:remote-registry` (import from `serverEntry`) |
| `htmlTemplate` | Shell filename in outDir (default `index.html`) |
| `htmlShell` | Custom per-route HTML assembly |
| `images` | Sharp build variants, `Image` metadata |

## Build outputs

### SSR + hybrid client split

When `serverEntry` is set, client build uses `dist/client` (config hook in plugin `config()`). Server bundle lands in `dist/server/`.

### SSG artifacts

Under client `outDir`:

- `index.html`, `about.html`, `posts/hello/index.html`, etc.
- Filled documents (no `{{kiru_*}}` placeholders)
- `404.html` when generated
- `sitemap.xml`, `robots.txt` from `site.config.ts`

### Manifest

`build.manifest: true` enabled for SSG builds — used for modulepreload in prerender HTML.

## Dev server behavior

| Config | HTML handling |
|--------|----------------|
| CSR | Vite SPA |
| SSG only | Transform `index.html`; optional SSG middleware |
| `serverEntry` | Plugin loads server module, calls `app.fetch`, injects CSS links + Kiru devtools |

**Hybrid dev:** `serverEntry` always wins — prerender disk **not** used in dev (live SSR for static routes).

## `vite preview` modes

Documented in `packages/vite-plugin-kiru/README.md`:

| Mode | Behavior |
|------|----------|
| CSR | Standard static + SPA fallback |
| SSG only | `createSsgPreviewMiddleware` → prerender files → `404.html` |
| SSR / hybrid | Serve `dist/client` assets + filled prerender; proxy rest to `node dist/server/index.js` |

Hybrid uses `requireFilledHtml: true` so empty shell `index.html` is not served for dynamic paths.

## Loader registry virtual module

When `serverEntry` set:

```ts
// virtual:kiru:loader-registry
// import { __INTERNAL_LOADER_REGISTRY } from "kiru/router/loaderRegistry"
// registerLazyImport per route with serverLoader
```

Resolved in `configResolved` via `renderLoaderRegistryVirtual`. Page modules with `serverLoader` get client `__kiruEnsureLoaderDispatch` from `kiru/router/loaderClient`.

## Cloudflare adapter build

`router.adapter: "cloudflare"`:

- Emits worker-oriented SSR bundle
- `wrangler.toml.generated` helper output
- Warns on ISR exports incompatible with edge

## Images plugin hook

`router.images` → `packages/vite-plugin-kiru/src/image/`:

- Static import metadata
- Optional WebP/AVIF variants at build
- Pairs with `defineImageConfig({ strategy: "build" | "runtime" })`

See [12-head-seo-sitemap-images.md](./12-head-seo-sitemap-images.md).

## Removed options

- `virtualManifest` — use Vite manifest
- Old FileRouter SSG integration

## Site module resolution

Default: sibling `site.config.ts` or `.js` next to routes.

```ts
ssg: {
  routes: "./src/routes.ts",
  siteModule: "./src/site.config.{ts,js}",
}
```

## Use-case: CI build pipeline

```bash
vite build                    # client + prerender + server
node dist/server/index.js     # production (not vite preview for hybrid parity)
```

E2E: `e2e/ssr/scripts/verify-hybrid-prerender.mjs` asserts `/docs` disk HTML.

## Use-case: monorepo package routes

```ts
ssg: { routes: "../../packages/app/src/routes.ts" }
```

Glob must resolve to exactly one file (`resolveSingleModulePattern`).

## Debugging tips

| Issue | Check |
|-------|--------|
| Empty prerender pages | Shell still has `{{kiru_body}}` — build step failed |
| SSR dev 404 | `serverEntry` export `fetch` |
| Loader RPC 401 | `actions.secret` / context token |
| Stale hybrid static in prod | ISR TTL; `revalidatePath` |

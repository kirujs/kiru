# SSR adapter matrix (e2e)

Exercises Kiru SSR handlers across Node, Bun, and Cloudflare Workers (fetch / Hono / Elysia).

## Cloudflare golden sample

Worker cells (`worker-fetch`, `worker-hono`, `worker-elysia`) are the reference deploy path:

- Vite `router.adapter: "cloudflare"` — see [`vite.config.ts`](vite.config.ts)
- Generated [`wrangler.toml.generated`](wrangler.toml.generated) after production build
- Server entries under [`src/servers/worker-*.ts`](src/servers/) using `@kirujs/adapter-cloudflare` (`createKiruWorkerHandle`, `getAsset`, `assetFetch`)

**ISR on Cloudflare:** use immutable prerender (`revalidate: false`) or `dynamic: "force-dynamic"`. Timed `revalidate` and cache `tags` fail the client build via `assertISRAllowed` in `vite-plugin-kiru`.

## Commands

```bash
# Full matrix (Node + Bun + Workers)
pnpm test

# Single cell
KIRU_MATRIX_CELL=worker-hono pnpm run test:cell

# PR smoke (ISR guard + one Worker cell)
node ./scripts/cloudflare-smoke.mjs
```

Deploy documentation: `docs/v2/DEPLOY-CLOUDFLARE.md` (Sprint 5).

# E2E SSR matrix (runtimes × HTTP frameworks)

How to test **one Kiru SSR app** across multiple **deploy runtimes** and **HTTP framework** wiring patterns, without duplicating route trees or re-implementing adapter logic in each package.

This complements:

- [`e2e/ssr`](../../e2e/ssr) — full Cypress coverage (loaders, ISR, forms, tier 3, etc.)
- [`deploy-runtimes.md`](./deploy-runtimes.md) — mix-and-match: `createKiruResponder` + userland catch-all

---

## Goals

1. **Same fixture** — one `routes` tree and pages; only the server entry changes per cell.
2. **Explicit HTTP wiring** — each cell uses the documented `kiru.handle` → `Response | null` → framework response pattern (logging, API routes, 404 policy stay visible in server files).
3. **Fast default CI** — smoke every matrix cell; full Cypress only where depth is needed.
4. **Valid cells only** — skip impossible pairs (e.g. Express on Cloudflare Workers).

---

## Current state

| Package | App | What it tests |
|---------|-----|----------------|
| [`e2e/ssr-matrix`](../../e2e/ssr-matrix) | Shared fixture + per-cell servers | Adapter smoke: Node/Bun × (fetch, hono, express, fastify, elysia) + Worker (fetch, hono, elysia) |
| [`e2e/ssr`](../../e2e/ssr) | Full route tree | Cypress (mostly Vite dev); tier 3 on prod Node `dist/server` |

Former `e2e/ssr-bun` and `e2e/ssr-worker` mini-apps were removed in phase 4; use matrix cells `bun-*` and `worker-*` instead.

---

## Architecture

```text
e2e/ssr/                    ← canonical fixture (routes, pages, full Cypress)
e2e/ssr-matrix/             ← matrix runner + per-cell server entries
  src/
    fixture/                ← re-export or share routes with e2e/ssr
    servers/
      node-fetch.ts         ← export default { fetch: kiru.fetch } or createServer(toNodeListener(kiru))
      node-hono.ts
      node-express.ts
      node-fastify.ts
      bun-hono.ts
      worker-fetch.ts
      ...
  scripts/
    smoke-core.mjs          ← shared HTTP assertions
    run-cell.mjs            ← build → start one cell → smoke → exit
    matrix.mjs              ← run all cells (sequential or parallel)
  package.json
  vite.config.ts            ← serverEntry from KIRU_MATRIX_CELL
```

### Per-cell server entry

Each file under `src/servers/` is **only** runtime + HTTP glue. Kiru logic lives in `createKiruResponder` (Node/Bun) or `createKiruWorkerHandle` (Workers).

**Node + Hono (example):** production uses `@hono/node-server` `serve()`; see [`node-hono.ts`](../../e2e/ssr-matrix/src/servers/node-hono.ts).

**Node + Elysia:** `@elysiajs/node` + `app.listen()`; see [`node-elysia.ts`](../../e2e/ssr-matrix/src/servers/node-elysia.ts).

**Express / Fastify:** Kiru `nodeRequestToFetch` + `writeNodeResponse` (no fetch listen adapter on npm yet).

**Node + Express (example):**

```ts
import {
  bindClientDisconnectAbort,
  createKiruResponder,
  nodeRequestToFetch,
  writeNodeResponse,
} from "@kirujs/adapter-node"
import express from "express"
import { routes } from "../fixture/routes.js"

const kiru = createKiruResponder({ importMetaUrl: import.meta.url, routes, stream: false })

const app = express()
app.get("/api/health", (_req, res) => res.json({ ok: true }))
app.use(async (req, res) => {
  const { request, abort } = nodeRequestToFetch(req)
  const unbind = bindClientDisconnectAbort(res, abort)
  try {
    const out = await kiru.handle(request)
    if (out === null) {
      res.status(404).send("Not Found")
      return
    }
    await writeNodeResponse(res, out, abort.signal)
  } finally {
    unbind()
  }
})

// listen in run-cell script or export for Bun-style serve
```

Build selects the entry via environment variable, e.g. `KIRU_MATRIX_CELL=node-hono` → Vite `router.serverEntry: src/servers/node-hono.ts`.

---

## Matrix cells

| Runtime | `fetch` only | Hono | Express | Fastify | Elysia |
|---------|--------------|------|---------|-----------|--------|
| **Node** | yes | yes | yes | yes | yes |
| **Bun** | yes | yes | yes | yes | yes |
| **Cloudflare Workers** | yes | yes | — | — | yes |

- **Express / Fastify on Workers** — out of scope (no Node `IncomingMessage` / `ServerResponse`).
- **Cell id convention** — `{runtime}-{framework}`, e.g. `node-express`, `bun-hono`, `worker-fetch`. Use `node-fetch` / `bun-fetch` for `kiru.fetch`, `createServer(toNodeListener(kiru))`, or `Bun.serve` with no extra framework.

### Runtime-specific notes

| Runtime | Start command (typical) | Kiru factory |
|---------|-------------------------|--------------|
| Node | `node dist/server/index.js` | `createKiruResponder`; Hono → `@hono/node-server`, Elysia → `@elysiajs/node` |
| Bun | `bun dist/server/index.js` | `createKiruBunServer`; Hono/Elysia use native `fetch` / `.listen()` |
| Cloudflare | `wrangler dev --port <port> --local` | `createKiruWorkerHandle` — returns `Response | null` in worker `fetch` |

**Worker + Elysia:** `CloudflareAdapter` + `.compile()` ([Elysia CF docs](https://elysiajs.com/integrations/cloudflare-worker)); `compatibility_date` ≥ `2025-06-01` in [`wrangler.toml`](../../e2e/ssr-matrix/wrangler.toml).

Spawn/wait logic lives in [`e2e/ssr-matrix/scripts/run-cell.mjs`](../../e2e/ssr-matrix/scripts/run-cell.mjs) and [`lib.mjs`](../../e2e/ssr-matrix/scripts/lib.mjs). For prod Node tier-3 Cypress, see [`e2e/ssr/cypress.tier3.config.ts`](../../e2e/ssr/cypress.tier3.config.ts).

---

## Two test tiers

### Tier A — matrix smoke (every cell, fast)

Shared script (`smoke-core.mjs`), invoked by `run-cell.mjs` after the server is up:

| Check | Purpose |
|-------|---------|
| `GET /` | SSR body present; no raw `{{kiru_body}}` / `{{kiru_head}}` in response |
| `GET /hello` | Second route renders |
| `GET /api/health` | Framework route registered **before** Kiru catch-all |
| `GET /no-such-kiru-route` (optional) | Assert chosen `null` policy (404 body/status) |

Does **not** replace loader, ISR, form, or navigation tests — those stay in `e2e/ssr`.

### Tier B — full Cypress (subset, slow)

Keep [`e2e/ssr`](../../e2e/ssr) as the **deep** suite (600+ lines across specs).

Optional later: `cypress/e2e/matrix.cy.ts` + config that starts one cell via `CYPRESS_MATRIX_CELL` — run on 2–3 representative cells (e.g. `node-fetch`, `node-hono`, `bun-express`), not the full matrix × full spec set.

| When | What runs |
|------|-----------|
| PR / default `pnpm test` | `e2e/ssr` Cypress (existing) + matrix Tier A smoke |
| Nightly / manual | Extra Cypress matrix specs on selected cells |

---

## Commands

```bash
# One cell (build + start + smoke)
KIRU_MATRIX_CELL=node-express pnpm --filter e2e-ssr-matrix test:cell

# Full matrix locally
pnpm --filter e2e-ssr-matrix test:matrix

# From repo root (builderman)
pnpm test   # includes e2e:ssr-matrix after e2e:ssr
```

Build selects the server entry via `KIRU_MATRIX_CELL` in [`e2e/ssr-matrix/vite.config.ts`](../../e2e/ssr-matrix/vite.config.ts). Routes live under `src/fixture/` with [`src/routes.ts`](../../e2e/ssr-matrix/src/routes.ts) re-exporting for the Vite plugin’s default discovery path.

### `matrix.mjs` cell registry (concept)

```js
/** @type {import('./matrix-types').MatrixCell[]} */
export const cells = [
  {
    id: "node-fetch",
    runtime: "node",
    build: { env: { KIRU_MATRIX_CELL: "node-fetch" } },
    start: { command: "node", args: ["dist/server/index.js"] },
  },
  {
    id: "bun-hono",
    runtime: "bun",
    build: { env: { KIRU_MATRIX_CELL: "bun-hono" } },
    start: { command: "bun", args: ["dist/server/index.js"] },
  },
  {
    id: "worker-fetch",
    runtime: "wrangler",
    build: { env: { KIRU_MATRIX_CELL: "worker-fetch" } },
    start: {
      command: "pnpm",
      args: ["exec", "wrangler", "dev", "--port", "{port}", "--local"],
      cwd: "<package-root>",
    },
  },
]
```

`run-cell.mjs` allocates a free port, sets `PORT`, spawns `start`, runs `smoke-core.mjs`, then tears down the process (same discipline as tier 3 Cypress setup).

---

## Shared fixture strategies

Pick one approach when implementing:

### Option 1 — Import from `e2e/ssr` (simplest)

```ts
// e2e/ssr-matrix/src/fixture/routes.ts
export { routes } from "../../ssr/src/routes.js"
```

Matrix smoke uses a **small** subset of paths (`/`, `/hello`). Full `e2e/ssr` tree remains available if imported wholesale.

### Option 2 — `e2e/ssr-fixture` package (cleanest long-term)

Workspace package with minimal routes + pages only; both `e2e/ssr` and `e2e/ssr-matrix` depend on it. Avoids coupling matrix to the entire kitchen-sink app.

### Matrix-only minimal routes (recommended for smoke)

Independent of option 1/2, smoke can target pages dedicated to the matrix:

| Path | Role |
|------|------|
| `/` | Home — identifiable SSR string in body |
| `/hello` | Second SSR route |
| `/api/health` | Non-Kiru JSON (framework only) |

Full `e2e/ssr` routes (loaders, ISR, tier 3) stay in `e2e/ssr` only.

---

## CI integration

### Builderman

Add `e2e:ssr-matrix` alongside existing tasks in [`builderman.js`](../../builderman.js):

```text
e2e:csr → e2e:ssg → e2e:ssr → e2e:ssr-matrix
```

`e2e:ssr-matrix` depends on `adapter-contract`, `adapter-node`, `adapter-bun`, `adapter-cloudflare`, `vite-plugin-kiru`, and `lib` — same as other SSR e2e packages.

### GitHub Actions — what works and what does not

The snippet below is a **shape**, not a drop-in workflow. A single job that only runs `node dist/server/index.js` would **not** correctly test `bun-*` or `worker-fetch` cells.

| Concern | Node / framework cells | Bun cells | `worker-fetch` |
|---------|------------------------|-----------|----------------|
| **Serve** | `node dist/server/index.js` | `bun dist/server/index.js` (Bun auto-serves `export default { fetch }`) | `wrangler dev --port … --local` (no Node listen) |
| **Build app** | `vite build` (Node) is fine | Prefer **`bunx --bun vite build`** so Vite runs under Bun ([Bun + Vite](https://bun.com/docs/guides/ecosystem/vite)) | Vite worker bundle; Node or `bunx --bun vite build` |
| **Monorepo packages** | `pnpm build` at root (Node) builds `kiru`, adapters, plugin — required once before matrix | Same | Same + Wrangler CLI for serve step |
| **CI tools** | Node 22 | Node 22 **+ Bun** (`oven-sh/setup-bun`) | Node 22 + Bun optional; **Wrangler** via devDependency |

All of that belongs in **`run-cell.mjs`** (and the cell registry), not in duplicated YAML per cell. The workflow should only set `KIRU_MATRIX_CELL` and call `test:cell`.

```js
// run-cell.mjs (conceptual)
const cell = cells.find((c) => c.id === process.env.KIRU_MATRIX_CELL)

await buildMonorepoIfNeeded() // root pnpm build — adapters + kiru (Node)

if (cell.runtime === "bun") {
  await exec("bunx", ["--bun", "vite", "build"], { cwd: packageRoot, env: cell.buildEnv })
} else {
  await exec("pnpm", ["exec", "vite", "build"], { cwd: packageRoot, env: cell.buildEnv })
}

const port = await getFreePort()
const child = spawn(...cell.startCommand(port))
await smokeCore({ base: `http://127.0.0.1:${port}` })
```

#### Recommended GHA layout

**Option A — one job, smart `run-cell` (simplest)**  
Install Node + Bun on every runner; `run-cell` branches on cell id. Slightly wasteful but correct.

**Option B — split by runtime family (faster, clearer logs)**

```yaml
jobs:
  e2e-matrix-node:
    strategy:
      matrix:
        cell: [node-fetch, node-hono, node-express, node-fastify, node-elysia]
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22 }
      - run: pnpm install && pnpm build
      - run: pnpm --filter e2e-ssr-matrix test:cell
        env:
          KIRU_MATRIX_CELL: ${{ matrix.cell }}

  e2e-matrix-bun:
    strategy:
      matrix:
        cell: [bun-fetch, bun-hono, bun-express, bun-fastify, bun-elysia]
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22 }
      - uses: oven-sh/setup-bun@v2
      - run: pnpm install && pnpm build
      - run: pnpm --filter e2e-ssr-matrix test:cell
        env:
          KIRU_MATRIX_CELL: ${{ matrix.cell }}

  e2e-matrix-worker:
    strategy:
      matrix:
        cell: [worker-fetch, worker-hono, worker-elysia]
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22 }
      - run: pnpm install && pnpm build
      - run: pnpm --filter e2e-ssr-matrix test:cell
        env:
          KIRU_MATRIX_CELL: ${{ matrix.cell }}
```

Worker cells share Wrangler startup cost; keep a generous `timeout-minutes` per job.

Do **not** rely on a single global `pnpm build` inside `e2e-ssr-matrix` to imply the right runtime — root build compiles workspace packages; **per-cell** `vite build` must use the cell’s toolchain (`bunx --bun` for Bun cells).

Keep **full Cypress** in a separate job so PRs do not multiply browser time by cell count.

### Bun cells in the matrix

`bun-*` cells use **`bunx --bun vite build`** (see `cellBuildCommand` in [`scripts/lib.mjs`](../../e2e/ssr-matrix/scripts/lib.mjs)) and **`bun dist/server/index.js`** to serve. Vite `router.adapter` is `"bun"` when `KIRU_MATRIX_CELL` matches a Bun cell. Root `pnpm build` still compiles workspace packages with Node.

---

## Implementation phases

| Phase | Scope | Outcome |
|-------|--------|---------|
| **1** | `e2e/ssr-matrix` package, `smoke-core.mjs`, `run-cell.mjs`, cells: `node-fetch`, `node-hono`, `node-express`, `bun-fetch`, `worker-fetch` | Core runtimes + sample frameworks in CI |
| **2** | Done — `node-fastify`, `node-elysia`, `bun-hono`, `bun-express`, `bun-fastify`, `bun-elysia`, `worker-hono`, `worker-elysia` | Full framework grid on Node/Bun + Worker hono/elysia |
| **3** | Optional Cypress `matrix.cy.ts` on 2–3 cells | Deeper browser checks on representative wiring |
| **4** | Done — removed `e2e/ssr-bun` / `e2e/ssr-worker` | Single matrix source of truth for adapter smoke |

---

## What the matrix does *not* test

- Full loader RPC, invalidation, ISR regen, forms, streaming edge cases — [`e2e/ssr`](../../e2e/ssr)
- Vite dev middleware CSS injection path — `e2e/ssr` Cypress via Vite dev server
- Every combination of `stream: true`, images, i18n — configure in fixture once; spot-check in Cypress

Treat the matrix as **adapter integration** coverage: “this runtime + this HTTP shape can serve Kiru SSR for real routes.”

---

## Related docs

- [Deploy runtimes](./deploy-runtimes.md) — `createKiruResponder`, `Response | null`, framework examples
- [Tier 2 framework parity](../router-roadmap/tier-2-framework-parity.md) — adapter contract and HTTP mix-and-match
- [`e2e/ssr`](../../e2e/ssr) — primary SSR e2e app

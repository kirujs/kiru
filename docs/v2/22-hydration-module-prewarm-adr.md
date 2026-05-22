# ADR: Hydration module pre-warm (`modulepreload`)

**Status:** Accepted — **ships v2.0**  
**Sprint:** S6 (P1-13)  
**Related:** [09-client-bootstrap-and-hydration.md](./09-client-bootstrap-and-hydration.md), [06-loaders-and-data.md](./06-loaders-and-data.md), [13-vite-plugin-and-build-pipeline.md](./13-vite-plugin-and-build-pipeline.md)

---

## Context

SSR/SSG apps code-split route modules (`component: () => import("./page")`). On first paint and client navigations, `loadRouteTree` must `import()` those modules. Without hints, the browser only starts fetching chunks when `import()` runs — a serial waterfall after the HTML arrives.

Loader **data** prefetch (`Link` hover → `POST ?loader=`) is separate; it does not fetch JS chunks.

---

## Rejected

| Approach | Why |
|----------|-----|
| One `<script type="module">` per layout/page | Script explosion, duplicate runtime risk, ordering/CSP/cache pain |
| Replacing all `import()` with preloads only | `modulepreload` does not return module exports; route factories must still run on navigate/hydrate |
| Speculative `import()` on Link hover (pre-v2) | Duplicates network work; can evaluate modules early |

---

## Decision

Hydration pre-warm uses **two layers** (similar in spirit to Next.js `preload` of the webpack runtime + route chunks):

| Layer | What | How |
|-------|------|-----|
| **Bootstrap** | Static imports of the client entry (`_jsx`, `_link`, router slices, etc.) | `<link rel="modulepreload" … fetchpriority="low">` — fetch early without competing with LCP |
| **Route** | Layout + page chunks for the matched URL | `<link rel="modulepreload" …>` — same as before, excluding entry and bootstrap URLs |

1. **Build** emits [`kiru-route-chunks.json`](../../packages/vite-plugin-kiru/src/hydrationChunks.ts) with `bootstrap`, `entry`, `byRouteId`, `byPathname`.
2. **SSR/SSG first paint** injects bootstrap links first, then route links in `{{kiru_head}}`. The entry still loads via a single `<script type="module">` (not duplicated).
3. **Link hover** (`prefetch.chunks: true`) injects **route-only** links for the target match (bootstrap is already on the document from first paint).
4. **Navigate/hydrate** still calls `component()` / `layout?.()`; preloads only warm the module graph.

We use **`modulepreload`** (not `preload as="script"`) because Vite ships an ESM graph. `fetchpriority="low"` on bootstrap approximates Next’s low-priority runtime preload without fighting the document’s critical resources.

---

## Artifacts

| File | Role |
|------|------|
| `kiru-route-chunks.json` | Client asset: `bootstrap`, `entry`, `byRouteId`, `byPathname`, `modules` |
| `packages/lib/src/router/hydrationChunks.ts` | Resolve URLs, format links, client registry |
| `packages/vite-plugin-kiru/src/hydrationChunks.ts` | Build manifest from routes source + Vite manifest |

`createRenderer` loads `kiru-route-chunks.json` from `prerenderedHtmlDir` when `hydrationChunks` is not passed explicitly.

---

## API

- `LinkPrefetch.chunks` — `true` → manifest-driven `modulepreload` only (default when loader RPC exists: `chunks: true`, `data: true`).
- `createRenderer({ hydrationChunks })` — optional override.

---

## CSP

Strict `Content-Security-Policy` must allow `link-src` (or `default-src`) for same-origin chunk URLs. Documented in [SECURITY.md](./SECURITY.md) when published (S6-6).

---

## Post-v2 (not in scope)

- Tiered `warm` / `cold` preloads, `requestIdleCallback`, viewport idle speculation (P3-8).
- `k-hydration-modules` JSON bootstrap (only if streaming head cannot fit `<link>` tags).

---

## Acceptance (v2.0)

- Multi-layout SSR/SSG HTML includes route `modulepreload` links.
- Link hover on hydrated SSR/SSG adds target-route preloads before navigation.
- Streaming SSR e2e remains green (preloads are `<link>`, not extra module scripts).

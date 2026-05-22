# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased] — v2.0.0 (draft)

### Added

- Router bootstrap entry points: `kiru/router/csr`, `kiru/router/ssr`, `kiru/router/ssg` with `createRouterApp` per rendering mode.
- File-based routes (`@kirujs/file-routes`, `router.fileRoutes` in vite-plugin): layouts, errors, not-found, route groups, `extendRoutes`.
- Configurable FBR special filenames: `layoutFiles`, `errorFiles`, `notFoundFiles` (in addition to `pageFiles`).
- Remote actions: default-export action objects, linked `*.actions.ts`, `ActionFailure`, `actionResponse` cookies, `x-kiru-invalidate`.
- Hybrid ISR / PPR on Node and Bun (`defineISR`, cache tags, on-demand revalidation).
- Route middleware with redirect, abort, and HTTP error results (SSR and CSR after P0-1 fix).
- `@kirujs/runtime` deploy capabilities and `assertISRAllowed` for edge targets.
- Adapters: `@kirujs/adapter-node`, `@kirujs/adapter-bun`, `@kirujs/adapter-cloudflare`.
- `docs/v2/` architecture and release documentation set.

### Changed

- **Breaking:** Client apps must import `createRouterApp` from the bootstrap path matching the document (`csr` | `ssr` | `ssg`). See [docs/v2/BREAKING-CHANGES.md](./docs/v2/BREAKING-CHANGES.md).
- **Breaking:** Prefer `ActionFailure` / `fail()` from `kiru/remote` over legacy `actionFail` / `__kiruFail` wire envelopes.
- CSR middleware `{ error: status }` renders the error outlet instead of redirecting to `/login`.
- `packages/lib` test runner executes `*.test.tsx` (router, hydration, dev warnings).

### Fixed

- CSR middleware `{ error: 403 }` no longer hard-redirects to `/login` (P0-1).
- SSR hydrate outlet parity: `isNavigating`, `isLoaderPending`, `outletRenderError` (Sprint 2).

### Security

- Document planned: RPC threat model for `?action=` / `?loader=` (Sprint 5 — `docs/v2/SECURITY.md`).

### Known limitations (v2.0.0)

- Cloudflare Workers: no timed ISR or cache tags; build fails via `assertISRAllowed` when route meta uses them.
- No first-party `/api` routes — multiplex handlers + BYO HTTP framework.
- Dual client outlet paths (`RouterView` vs `subscribeSsrClientOutlet`) — documented in [docs/v2/09-client-bootstrap-and-hydration.md](./docs/v2/09-client-bootstrap-and-hydration.md).

---

## [1.5.3] — prior release line

See git history on `main` for v1.x changes. v2 is a major router, build, and remote-actions rework on the current branch.

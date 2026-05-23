# File-based routes E2E apps

Three fixtures exercise `@kirujs/file-routes` codegen under different render modes:

| App | Mode | Port / server | Spec |
|-----|------|---------------|------|
| [`e2e/file-routes`](../file-routes/) | CSR (Vite dev) | 5175 | `file-routes.cy.ts` (7 tests) |
| [`e2e/file-routes-ssr`](../file-routes-ssr/) | SSR (`serverEntry` + Vite dev) | 5194 | `file-routes-ssr.cy.ts` (4 tests) |
| [`e2e/file-routes-ssg`](../file-routes-ssg/) | SSG (build + preview) | dynamic preview | `file-routes-ssg.cy.ts` (4 tests) |

Shared page tree: home, about, guarded middleware redirect, dynamic `[slug]`, route group `/pricing`, `routes.extend.ts` manual route, not-found.

Run from repo root: `node builderman.js test` (includes all three in the parallel e2e pipeline). Ports: `e2e/shared/ports.mjs`.

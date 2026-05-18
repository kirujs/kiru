# Kiru

Development monorepo for **Kiru**.

Kiru is a lightweight rendering library that aims to provide a familiar development experience for those with HTML and Javascript experience, now with declarative routing primitives for CSR/SSG/SSR flows.

## Structure

- `.github`
  - Contains workflows used by GitHub Actions.
- `assets`
  - Contains Kiru brand assets.
- `e2e`
  - Contains end-to-end test suite.
- `packages`
  - Contains the individual packages managed in the monorepo.
  - [kiru](https://github.com/kirujs/kiru/blob/main/packages/lib) - the core library
  - [create-kiru](https://github.com/kirujs/kiru/blob/main/packages/create-kiru) - a CLI tool to quickly get started with a new Kiru project
  - [vite-plugin-kiru](https://github.com/kirujs/kiru/blob/main/packages/vite-plugin-kiru) - a Vite plugin to enable HMR & devtools
  - [devtools-host](https://github.com/kirujs/kiru/blob/main/packages/devtools-host) - the devtools app injected into the browser during development
  - [devtools-shared](https://github.com/kirujs/kiru/blob/main/packages/devtools-shared) - shared code used by the devtools app
- `sandbox`
  - Contains example applications and random tidbits.

## Development

This repository uses [pnpm](https://pnpm.io) as a package manager and [builderman](https://www.npmjs.com/package/builderman) to handle orchestration of tasks & build caching.

- `pnpm build`: run the build script in each package
- `pnpm test`: run the test script in each package
- `pnpm dev`: run the dev script in each package

To get started, run `pnpm i` and then `pnpm dev`.
You can then run any app from the `sandbox` folder and it will be live-reloaded as you make changes within the app or any of the other packages.

## Declarative Router (preview)

Phased roadmap (docs, adapters, parity, optional differentiation): [docs/router-roadmap/README.md](docs/router-roadmap/README.md).

Kiru now exposes `kiru/router` primitives for route trees and rendering strategies:

- `defineRouteTree` for route declarations
- CSR runtime via `createRouter`, `RouterProvider`, `RouterView`, `Link`
- SSR rendering via `createRenderer`
- SSG prerender helpers via `prerenderStaticRoutes`

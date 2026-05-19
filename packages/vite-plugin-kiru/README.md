# vite-plugin-kiru

Vite plugin for <a href="https://kirujs.dev">Kiru</a> apps that enables HMR, devtools, and declarative routing build hooks.

## Basic Usage

```ts
// vite.config.ts
import { defineConfig } from "vite"
import kiru from "vite-plugin-kiru"

export default defineConfig({
  plugins: [kiru()],
})
```

## Configuration

```ts
kiru({
  // Enable or disable the Kiru devtools.
  // Defaults to true in development mode.
  devtools: false,

  // Or provide configuration for the devtools client
  devtools: {
    // Path where the devtools client will be served
    pathname: "/devtools", // default: "/__devtools__"
    // Optional - function to format file links that will be displayed in the devtools
    formatFileLink: (path, line) => `vscode://file/${path}:${line}`,
  },

  // Additional directories (relative to root) to include in transforms.
  include: ["../shared/"],

  // Enable logging for debugging
  loggingEnabled: true,

  // Callbacks
  onFileTransformed: (id, content) => {
    console.log(`Transformed: ${id}`)
  },
  onFileExcluded: (id) => {
    console.log(`Excluded: ${id}`)
  },

  // Declarative router integration
  router: {
    // Paths and globs (routes + serverEntry must match exactly one file)
    serverEntry: "./src/server/index.{ts,js}",
    ssg: {
      routes: "./src/routes.{ts,tsx}",
      siteModule: "./src/site.config.{ts,js}",
    },
    remote: "**/*.actions.ts",
    // HTML file in outDir to use as the shell after the client build (default: index.html).
    // Must include `{{kiru_head}}` and `{{kiru_body}}` template tokens.
    htmlTemplate: "index.html",
    // Optional: return a full HTML string per route instead of template injection.
    htmlShell: (body, path, document) => `<!doctype html>...`,
  },
})
```

## Static site generation (SSG)

With `router.ssg` enabled (`true` or `{ routes }`), the plugin:

1. Runs the normal client `vite build` (so `index.html` gets real hashed JS/CSS).
2. Starts a short-lived Vite server and loads your routes module with `ssrLoadModule` (TypeScript-safe).
3. Calls `prerenderStaticRoutes` from `kiru/router` for every static path.
4. Merges each result into a **copy** of the built `index.html` via `fillRouteHtmlTemplate` (also exported from `kiru/router` for custom SSR servers).

Your source `index.html` should include `{{kiru_head}}` in `<head>` and `{{kiru_body}}` at the app mount location (for example `<div id="app">{{kiru_body}}</div>`).

You do **not** need a separate `prerender.ts` script.

### Site config (`src/site.config.ts`)

Add **`src/site.config.ts`** (or use a glob like **`router.ssg.siteModule: "./src/site.config.{ts,js}"`**). Export `site` from `defineSiteConfig()` to generate `sitemap.xml` and optional `robots.txt` after prerender.

`router.ssg.routes`, `router.ssg.siteModule`, and `router.serverEntry` accept [tinyglobby](https://github.com/SuperchupuDev/tinyglobby) patterns. Routes and server entry must match **exactly one** file; `siteModule` may match multiple files (`.ts` preferred over `.js`). `router.remote` already accepts multi-match globs.

```ts
// vite.config.ts — glob examples
router: {
  ssg: { routes: "./src/routes.ts", siteModule: "./src/site.config.{ts,js}" },
  serverEntry: "./src/server.{ts,js}",
  remote: "**/*.actions.ts",
}
```

```ts
// src/site.config.ts
import { defineSiteConfig } from "kiru/router"

export const site = defineSiteConfig({
  url: "https://example.com",
  sitemap: true,
  robots: true,
  pathPolicy: { trailingSlash: "never", baseUrl: "/" },
})
```

`url` is the canonical site origin (canonical URLs, robots). Sitemap options can override the origin with `domain`, set defaults, and tune individual static paths:

```ts
export const site = defineSiteConfig({
  url: "https://example.com",
  sitemap: {
    domain: "https://example.com",
    changefreq: "weekly",
    priority: 0.8,
    lastmod: "build",
    overrides: {
      "/": { changefreq: "daily", priority: 1 },
      "/blog": {
        priority: 0.9,
        images: ["/images/hero.png"],
        videos: [
          {
            title: "Intro",
            thumbnail_loc: "/images/hero.png",
            description: "Site overview",
          },
        ],
      },
    },
  },
  robots: true,
})
```

You can also re-export `site` from your routes module instead of using a separate file.

Sitemap URLs are built with `generateSitemapPaths`:

- **Static routes** — same `generateStaticPaths` list used for prerender (`static: true` and `generateStaticParams` on dynamic segments).
- **SSR (hybrid)** — when `router.serverEntry` is set, every **non-static route without params** is included by default (for example `/`, `/about`).
- **Dynamic SSR routes** — opt in with `sitemap.include: ["/users/[id]"]` in `site.config.ts` and export `generateSitemapParams` from the **page module** (same `{ params }` shape as `generateStaticParams`). List parent path templates in `include` for nested dynamic routes.
- **`sitemap.exclude`** — pathname templates to omit after merging (for example demo or auth-only routes).

Export `generateStaticParams` from the page module for prerender only. Nested static routes can use parent params in `generateStaticParams({ params })` when a static parent exists (for example `/posts/[slug]` before `/posts/[slug]/comments/[id]`).

Route `head.jsonLd` objects are serialized as `<script type="application/ld+json">` tags in SSR/SSG output.

## Hybrid static routes + SSR

You can set **`router.ssg`** and **`router.serverEntry`** together. The client build still prerenders every route with `static: true` (and optional `generateStaticParams` on dynamic segments) into `dist/client`, then the plugin bundles your SSR server into `dist/server` as usual.

At runtime, **do not** serve `index.html` from disk for every path: the built shell still contains `{{kiru_head}}` / `{{kiru_body}}` placeholders until `createRenderer` fills them. Pass **`prerenderedHtmlDir: clientDir`** (from `resolveStatic`) into `createRenderer` — in **`NODE_ENV=production`** it serves `dist/client/*.html` for static routes (`generateStaticPaths`); **in development** disk is never read under that path, so static routes stay live SSR and are not overridden by stale builds.

`vite preview` behavior by mode:

- **CSR** — standard Vite static hosting from `dist` (SPA fallback to `index.html`).
- **SSG only** — serves prerendered HTML from `dist` (flat `*.html`, nested `*/index.html`, and `404.html` for unknown paths).
- **SSR / hybrid** — serves `dist/client` assets and filled prerender pages only; unknown paths are proxied to a child `node dist/server/index.js` (not the prerendered `404.html`). For full production parity with no preview glue, run `node dist/server` directly.

In development, **`router.serverEntry` always wins**: when both `ssg` and `serverEntry` are set, the plugin keeps the SSR dev middleware (so streaming, request context, and remote actions behave like a pure SSR app). Prerendered HTML is produced at `vite build` time only.

**Kiru devtools and `transformIndexHtml`:** SSG dev reads `index.html` through `server.transformIndexHtml`, so Vite plugin HTML transforms apply. SSR dev serves HTML from your server bundle (for example `resolveStatic` reading `index.html` from disk), which bypasses that pipeline. The plugin therefore injects the same Kiru devtools `<head>` snippet used by the `transformIndexHtml` hook into the SSR dev response (alongside dev CSS link injection). Other plugins that only contribute via `transformIndexHtml` still do not run on SSR-rendered documents unless you integrate them separately (for example by transforming the template before passing it to `createRenderer`).

## SSR client entry

For Node `createRenderer` HTML (non-streaming), hydrate with **`createRouterApp`** from **`kiru/router/ssr`** (or **`bootstrapSsrClient`** from **`kiru/ssr/router`**), not `RouterView` alone: `RouterView` uses async resources that expect streamed `kiru:deferred` payloads, which plain string SSR does not emit.

## Features

- **HMR**: Hot module replacement for fast development
- **Devtools**: Built-in development tools for debugging
- **TypeScript**: Full TypeScript support with proper type definitions
- **SSG**: Prerender static routes into the production HTML shell during `vite build`

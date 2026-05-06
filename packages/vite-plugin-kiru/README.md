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
    routesModule: "./src/routes.ts",
    virtualManifest: true,
    // When true, static routes are prerendered at the end of `vite build`.
    ssg: false,
    // HTML file in outDir to use as the shell after the client build (default: index.html).
    // Must include `{{kiru_head}}` and `{{kiru_body}}` template tokens.
    htmlTemplate: "index.html",
    // Optional: return a full HTML string per route instead of template injection.
    htmlShell: (body, path, document) => `<!doctype html>...`,
  },
})
```

## Static site generation (SSG)

With `router.ssg: true` and `router.routesModule` set, the plugin:

1. Runs the normal client `vite build` (so `index.html` gets real hashed JS/CSS).
2. Starts a short-lived Vite server and loads your routes module with `ssrLoadModule` (TypeScript-safe).
3. Calls `prerenderStaticRoutes` from `kiru/router` for every static path.
4. Merges each result into a **copy** of the built `index.html` via `fillRouteHtmlTemplate` (also exported from `kiru/router` for custom SSR servers).

Your source `index.html` should include `{{kiru_head}}` in `<head>` and `{{kiru_body}}` at the app mount location (for example `<div id="app">{{kiru_body}}</div>`).

You do **not** need a separate `prerender.ts` script.

## SSR client entry

For Node `createRenderer` HTML (non-streaming), hydrate with **`bootstrapSsrClient`** from **`kiru/ssr/router`**, not `RouterView` alone: `RouterView` uses async resources that expect streamed `kiru:deferred` payloads, which plain string SSR does not emit.

## Features

- **HMR**: Hot module replacement for fast development
- **Devtools**: Built-in development tools for debugging
- **TypeScript**: Full TypeScript support with proper type definitions
- **Declarative Routing**: Route manifest module via `virtual:kiru-routes`
- **SSG**: Prerender static routes into the production HTML shell during `vite build`

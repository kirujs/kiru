# Vite plugin

## Overview

`vite-plugin-kiru` integrates Kiru into Vite: JSX transforms, route codegen, remote/loader registries, SSG prerender, SSR dev middleware, and compile-time bootstrap selection. Import the default export as a Vite plugin array.

```ts
import kiru from "vite-plugin-kiru"

export default {
  plugins: [kiru({ /* options */ })],
}
```

Returns `[mainPlugin, remotePlugin]`.

---

## How it works

### Compile-time bootstrap

The plugin defines `__KIRU_ROUTER_BOOTSTRAP__`:

| Config | Value |
|--------|-------|
| No `serverEntry`, no `ssg` | `"csr"` |
| `ssg: true` only | `"ssg"` |
| `serverEntry` set | `"ssr"` (even with `ssg` — hybrid) |

Client code imports `createRouterApp` from the matching `kiru/router/*` entry. Tree-shaking removes unused mode code.

### Build pipeline

On `vite build`:

1. Generate `routes.gen.ts` when `fileRoutes` is enabled.
2. Transform `*.remote.ts` → client stubs + server registry.
3. Transform page loaders → loader RPC registry.
4. When `ssg` is set: run `prerenderStaticRoutes` for static routes.
5. When `serverEntry` is set: bundle the SSR server.
6. Emit `kiru-route-chunks.json`, `kiru-route-manifest.json` for hydration preloading.

### Dev SSR

When `serverEntry` is set, the plugin handles dev-mode SSR requests: loads the server module, calls `app.fetch`, injects CSS. No separate dev server proxy required.

### Virtual modules

| Module | Purpose |
|--------|---------|
| `virtual:kiru:remote-registry` | Server-side remote handler registry |
| `virtual:kiru:loader-registry` | Server-side loader RPC registry |

Import these in your server entry to wire HTTP handlers.

### HTML shell

`htmlTemplate` points to a built `index.html` with tokens:

- `{{kiru_head}}` — merged document head
- `{{kiru_body}}` — rendered app HTML

`htmlShell` optionally overrides the entire HTML document per route (advanced).

### 404 strategies

`notFoundStrategy` controls behavior for unmatched paths on static preview:

| Value | Behavior |
|-------|----------|
| `exact` | Return generated `404.html` or plain 404 |
| `csr-recovery` | Serve SPA shell for client-side recovery |
| `hybrid-ssr` | Forward misses to SSR server (default when `serverEntry` + `ssg`) |

---

## API reference

```ts
import kiru, { defaultEsBuildOptions, onHMR } from "vite-plugin-kiru"
```

```ts
type KiruPluginOptions = {
  devtools?: boolean | DevtoolsOptions
  include?: string[]
  loggingEnabled?: boolean
  onFileTransformed?: (id: string, content: string) => void
  onFileExcluded?: (id: string) => void
  experimental?: { staticHoisting?: boolean }
  router?: {
    ssg?: boolean | {
      routes?: string
      siteModule?: string
      build?: { maxConcurrentRenders?: number }
    }
    fileRoutes?: boolean | {
      dir?: string
      outFile?: string
      pageFiles?: string[]
      layoutFiles?: string[]
      errorFiles?: string[]
      notFoundFiles?: string[]
      extend?: string
    }
    notFoundStrategy?: "exact" | "csr-recovery" | "hybrid-ssr"
    adapter?: "node" | "bun" | "cloudflare"
    serverEntry?: string
    remote?: string
    htmlTemplate?: string
    htmlShell?: (body, path, document, assets?) => string | Promise<string>
  }
}
```

`defaultEsBuildOptions` — `{ jsx: "automatic", jsxImportSource: "kiru", loader: "tsx" }`.

---

## Examples

### Basic — CSR-only

```ts
// vite.config.ts
import { defineConfig } from "vite"
import kiru from "vite-plugin-kiru"

export default defineConfig({
  plugins: [kiru()],
})
```

```tsx
// main.tsx
import { createRouterApp } from "kiru/router/csr"
```

### Intermediate — SSR + remotes

```ts
export default defineConfig({
  plugins: [
    kiru({
      router: {
        serverEntry: "./src/server.ts",
        remote: "**/*.remote.ts",
        adapter: "node",
      },
    }),
  ],
})
```

```ts
// server.ts
import { createKiruHandler } from "@kirujs/adapter-node"
import "virtual:kiru:remote-registry"
import "virtual:kiru:loader-registry"

export default createKiruHandler({
  routes,
  importMetaUrl: import.meta.url,
})
```

```tsx
// client.tsx
import { createRouterApp } from "kiru/router/ssr"
```

### Intermediate — SSG + file routes

```ts
export default defineConfig({
  plugins: [
    kiru({
      router: {
        ssg: true,
        fileRoutes: {
          extend: "./src/routes.extend.ts",
        },
      },
    }),
  ],
})
```

```tsx
import { createRouterApp } from "kiru/router/ssg"
import { routes } from "./routes.gen"
```

### Advanced — hybrid SSG + SSR server

```ts
kiru({
  router: {
    ssg: true,
    serverEntry: "./src/server.ts",
    remote: "**/*.remote.ts",
    notFoundStrategy: "hybrid-ssr",
    adapter: "node",
  },
})
```

- Marketing pages: `static: true` → prerendered at build.
- App routes: SSR on demand with ISR support.
- Client: `kiru/router/ssr`.

### Advanced — custom HTML shell

```html
<!-- index.html -->
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    {{kiru_head}}
  </head>
  <body>
    <div id="app">{{kiru_body}}</div>
  </body>
</html>
```

```ts
kiru({
  router: {
    ssg: true,
    htmlTemplate: "index.html",
  },
})
```

### Advanced — Cloudflare adapter

```ts
kiru({
  router: {
    serverEntry: "./src/worker.ts",
    adapter: "cloudflare",
    remote: "**/*.remote.ts",
  },
})
```

Bundle targets Workers runtime. Use `@kirujs/adapter-cloudflare` for fetch handler wiring.

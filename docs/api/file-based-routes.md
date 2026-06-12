# File-based routes

## Overview

File-based routing (FBR) maps a `src/pages` directory tree to a Kiru route tree. The Vite plugin scans the filesystem at build/dev time, validates the tree, and emits `routes.gen.ts` — a typed `createRouteTree` module you import like a hand-written `routes.ts`.

For programmatic control, `@kirujs/file-routes` exposes `scanPagesDir`, `codegenRouteTree`, and `generateFileRoutes` for custom tooling.

---

## How it works

### Directory → URL mapping

Each folder under `pagesDir` contributes URL segments. A `page.tsx` (or `index.tsx`) in a folder becomes the leaf route for that path.

| Filesystem                      | URL          |
| ------------------------------- | ------------ |
| `pages/page.tsx`                | `/`          |
| `pages/about/page.tsx`          | `/about`     |
| `pages/posts/[id]/page.tsx`     | `/posts/:id` |
| `pages/docs/[...slug]/page.tsx` | `/docs/*`    |

Segment names in brackets become dynamic params; `[...rest]` captures the remainder.

### Recognized files per directory

| File pattern                          | Role                                            |
| ------------------------------------- | ----------------------------------------------- |
| `page.{tsx,ts,jsx,js}` or `index.*`   | Leaf route component                            |
| `layout.{tsx,ts,jsx,js,mdx}`          | Scope layout wrapping children                  |
| `error.{tsx,ts,jsx,js,mdx}`           | Error boundary for this scope                   |
| `not-found.{tsx,ts,jsx,js,mdx}`       | Custom 404 for this scope                       |
| `page.config.ts` / `page.config.js`   | Leaf config (`static`, `head`, `middleware`, …) |
| `scope.config.ts` / `scope.config.js` | Scope config for the directory                  |
| `middleware.ts`                       | Scope middleware module                         |

### Config module exports

`page.config.ts` and `scope.config.ts` export either:

```ts
export default { static: true, head: { title: "About" } }
// or
export const config = { static: true }
```

`resolveRouteConfig` reads `default` or `config`.

### Generated output

`routes.gen.ts` contains:

- `createRouteTree({ … })` with lazy `import()` for each page/layout
- `declare module "kiru/router" { interface RouteTree { … } }` for typed paths (disable with `augmentRouteTree: false` in tooling)

When `router.fileRoutes` is combined with `router.ssg: true` and no explicit `routes` path, SSG defaults to `./src/routes.gen.ts`.

### Vite integration

```ts
// vite.config.ts
import kiru from "vite-plugin-kiru"

export default {
  plugins: [
    kiru({
      router: {
        fileRoutes: true,
        // or
        fileRoutes: {
          dir: "./src/pages",
          outFile: "./src/routes.gen.ts",
          extend: "./src/routes.extend.ts",
        },
      },
    }),
  ],
}
```

---

## API reference

### Vite plugin

```ts
router.fileRoutes?:
  | boolean
  | {
      dir?: string           // default "./src/pages"
      outFile?: string       // default "./src/routes.gen.ts"
      pageFiles?: string[]
      layoutFiles?: string[]
      errorFiles?: string[]
      notFoundFiles?: string[]
      extend?: string        // module with extendRoutes
    }
```

### `@kirujs/file-routes`

```ts
import {
  generateFileRoutes,
  scanPagesDir,
  codegenRouteTree,
  validateTree,
  parseDirSegment,
  urlSegmentsToPath,
  appendUrlSegment,
  DEFAULT_PAGE_FILES,
  DEFAULT_LAYOUT_FILES,
  DEFAULT_ERROR_FILES,
  DEFAULT_NOT_FOUND_FILES,
} from "@kirujs/file-routes"

type FileRoutesOptions = {
  pagesDir: string
  outFile: string
  pageFiles?: string[]
  layoutFiles?: string[]
  errorFiles?: string[]
  notFoundFiles?: string[]
  augmentRouteTree?: boolean
}

type ScanPagesResult = {
  root: FileRouteDirNode
  routes: Map<string, string> // route path → page file abs path
}

type GenerateFileRoutesOptions = FileRoutesOptions & {
  extend?: string // path to module exporting extendRoutes
}

type GenerateFileRoutesResult = {
  source: string
  routes: Map<string, string>
}

function scanPagesDir(options: FileRoutesOptions): Promise<ScanPagesResult>

function generateFileRoutes(
  options: GenerateFileRoutesOptions
): Promise<GenerateFileRoutesResult>
```

---

## Examples

### Basic — enable FBR and import generated routes

```ts
// vite.config.ts
kiru({ router: { fileRoutes: true } })
```

```ts
// main.tsx
import { createRouterApp } from "kiru/router/csr"
import { routes } from "./routes.gen"

void createRouterApp({
  routes,
  container: document.getElementById("app")!,
})
```

### Intermediate — `page.config.ts`

```ts
// pages/about/page.config.ts
import type { RoutePageConfig } from "kiru/router"

export default {
  static: true,
  head: {
    title: "About us",
    description: "Learn about our team",
  },
} satisfies RoutePageConfig
```

### Intermediate — `scope.config.ts`

```ts
// pages/dashboard/scope.config.ts
import type { RouteScopeConfig } from "kiru/router"

declare module "kiru/router" {
  interface RouteMeta {
    requiresAuth?: boolean
  }
}

export default {
  meta: { requiresAuth: true },
} satisfies Partial<RouteScopeConfig>
```

### Intermediate — directory `middleware.ts`

```ts
// pages/admin/middleware.ts
import type { RouteMiddleware } from "kiru/router"

const requireAdmin: RouteMiddleware = ({ context, to }) => {
  if (!context.user?.isAdmin) {
    return { redirect: "/login" }
  }
}

export default [requireAdmin]
// or: export const middleware = [requireAdmin]
```

Collected via `collectRouteMiddlewareModule` at codegen time.

### Advanced — full blog mini-app

```
src/pages/
  layout.tsx              # root layout + nav
  page.tsx                # /
  about/
    page.tsx
    page.config.ts        # static + SEO head
  blog/
    layout.tsx            # blog sub-layout
    page.tsx              # /blog
    [slug]/
      page.tsx            # /blog/:slug
      page.config.ts      # dynamic, ISR optional
  not-found.tsx           # root 404
```

```tsx
// pages/layout.tsx
import { Link, defineInterceptors } from "kiru/router"

export const interceptors = defineInterceptors({
  login: {
    path: "/login",
    render: ({ restore }) => <LoginModal onClose={restore} />,
  },
})

export default function RootLayout({ children }) {
  return () => (
    <div>
      <nav>
        <Link to="/">Home</Link>
        <Link to="/blog">Blog</Link>
        <Link to="/about">About</Link>
      </nav>
      <main>{children}</main>
    </div>
  )
}
```

```ts
// vite.config.ts — SSG + FBR
kiru({
  router: {
    ssg: true,
    fileRoutes: true,
  },
})
```

```tsx
// main.tsx
import { createRouterApp } from "kiru/router/ssg"
import { routes } from "./routes.gen"

void createRouterApp({ routes, container: document.getElementById("app")! })
```

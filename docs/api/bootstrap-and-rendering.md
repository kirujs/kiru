# Bootstrap & rendering

## Overview

Every Kiru routed app starts from a **bootstrap entry** that mounts or hydrates the router outlet into a DOM container. Three first-class entries exist — one per rendering mode. Each entry tree-shakes code paths that belong to other modes, keeping client bundles small.

| Entry | Package | Use when |
|-------|---------|----------|
| CSR | `kiru/router/csr` | Pure SPA, no server HTML |
| SSR | `kiru/router/ssr` | Server renders HTML; client hydrates and takes over navigation |
| SSG | `kiru/router/ssg` | Build emits static HTML; client hydrates with static hydration mode |

Advanced integrations can call `bootstrapSsrClient` or `bootstrapSsgClient` from `kiru/ssr/router` directly instead of the `createRouterApp` wrappers.

---

## How it works

### Shared base options

All three `createRouterApp` functions accept `CreateRouterAppBaseOptions`:

```ts
type CreateRouterAppBaseOptions = {
  /** Route tree from createRouteTree or a precompiled RouteManifest */
  routes: RouteTreeDefinition | RouteManifest
  /** DOM element receiving the router outlet */
  container: HTMLElement
  /** When false, omit <kiru-route-announcer> on document.body (default true) */
  navigationAnnouncer?: boolean
}
```

The bootstrap reads the current URL from `window.location`, matches it against the route manifest, runs loaders as appropriate for the mode, and renders `RouterView` inside `RouterProvider`.

### CSR (`kiru/router/csr`)

- Creates a `createRouter` instance with browser history.
- Mounts fresh DOM into `container` — no hydration.
- Enables `ensureLoaderClient()` for universal/client loaders on navigation.
- Extra options: `pathPolicy`, `transition`, `i18n`, `appOptions`.

`hydrationMode` in `appOptions` is not used on CSR.

### SSR (`kiru/router/ssr`)

- Expects the server to have already rendered HTML into `container` with embedded scripts: `k-page-data`, `k-request-context`, optional `k-i18n`, hydration chunk manifests.
- Calls `bootstrapSsrClient` with `hydrationMode: "dynamic"`.
- Replays server loader data on first paint; subsequent navigations may call the server via loader RPC (`POST /?loader=`).
- Wires remote function dispatch for mutations and queries from the browser.

### SSG (`kiru/router/ssg`)

- Expects prerendered HTML from `vite build` or `prerenderStaticRoutes`.
- Uses static hydration — loader data is read from inlined payloads, not RPC.
- Client navigations after hydration behave like CSR for universal loaders; `serverLoader` routes typically require a hybrid SSR server for dynamic data on nav.

### Hybrid (SSG + SSR)

Configure Vite with both `router.ssg: true` and `router.serverEntry`. Build prerenders `static: true` routes to HTML files; the SSR server handles dynamic routes and on-demand ISR. Client bootstrap is always `kiru/router/ssr` (compile-time define `ssr`).

### Hydration modes

| Mode | Set by | Behavior |
|------|--------|----------|
| `dynamic` | SSR bootstrap | Reconcile against server DOM; stream tail data when present |
| `static` | SSG bootstrap | One-shot hydrate from prerendered tree; no streaming replay |

Pass `hydrateOptions` on SSR/SSG bootstrap to forward options to the underlying `hydrate()` call from `kiru/ssr/client`.

### Navigation announcer

When `navigationAnnouncer` is true (default), Kiru injects a visually hidden live region that announces route title changes for screen readers after each navigation.

### View transitions

CSR-only: `transition: true` wraps navigations in the View Transitions API where the browser supports it.

### Path policy

CSR-only: `pathPolicy` configures `baseUrl` stripping and trailing-slash normalization before matching.

---

## API reference

### Shared types

```ts
type CreateRouterAppBaseOptions = {
  /** Route tree from createRouteTree or a precompiled RouteManifest — see routes-and-scopes.md */
  routes: RouteTreeDefinition | RouteManifest
  container: HTMLElement
  navigationAnnouncer?: boolean
}

type AppHandleOptions = {
  /** App name shown in devtools */
  name?: string
}

type AppHandle = {
  id: number
  name: string
  render(children: JSX.Element): void
  unmount(): void
}
```

`InternationalizationConfig` is defined in [i18n.md](./i18n.md). `RouteTreeDefinition` and `RouteManifest` are defined in [routes-and-scopes.md](./routes-and-scopes.md).

### `createRouterApp` — CSR

```ts
import { createRouterApp } from "kiru/router/csr"

type CreateRouterAppOptions = CreateRouterAppBaseOptions & {
  pathPolicy?: RouterPathPolicy
  transition?: boolean
  i18n?: InternationalizationConfig
  appOptions?: AppHandleOptions
}

function createRouterApp(options: CreateRouterAppOptions): Promise<AppHandle>
```

Returns an `AppHandle` with `.unmount()`.

### `createRouterApp` — SSR

```ts
import { createRouterApp } from "kiru/router/ssr"

type CreateRouterAppOptions = CreateRouterAppBaseOptions & {
  hydrateOptions?: AppHandleOptions
  i18n?: InternationalizationConfig
}

function createRouterApp(options: CreateRouterAppOptions): Promise<AppHandle>
```

### `createRouterApp` — SSG

```ts
import { createRouterApp } from "kiru/router/ssg"

type CreateRouterAppOptions = CreateRouterAppBaseOptions & {
  hydrateOptions?: AppHandleOptions
  i18n?: InternationalizationConfig
}

function createRouterApp(options: CreateRouterAppOptions): Promise<AppHandle>
```

### Low-level bootstrap

```ts
import { bootstrapSsrClient, bootstrapSsgClient } from "kiru/ssr/router"

function bootstrapSsrClient(options: {
  routes: RouteTreeDefinition | RouteManifest
  container: HTMLElement
  i18n?: InternationalizationConfig
  hydrateOptions?: AppHandleOptions
}): Promise<AppHandle>

function bootstrapSsgClient(options: /* same shape */): Promise<AppHandle>
```

### Advanced streaming primitives

```ts
import { renderToReadableStream } from "kiru/ssr/server"
import { hydrate } from "kiru/ssr/client"
```

Use when building custom server or hydrate pipelines outside `createRenderer` / `createRouterApp`.

---

## Examples

### Basic — CSR SPA

```tsx
// main.tsx
import { createRouterApp } from "kiru/router/csr"
import { routes } from "./routes"

const container = document.getElementById("app")!
void createRouterApp({ routes, container })
```

```ts
// routes.ts
import { createRoute, createRouteTree } from "kiru/router"

export const routes = createRouteTree({
  children: [
    createRoute("/", () => import("./pages/home")),
    createRoute("/about", () => import("./pages/about")),
  ],
})
```

### Intermediate — SSR client hydrate

```tsx
// client.tsx
import { createRouterApp } from "kiru/router/ssr"
import { routes } from "./routes"
import { i18n } from "./i18n"

void createRouterApp({
  routes,
  container: document.getElementById("app")!,
  i18n,
})
```

The server entry uses `createRenderer` or `createKiruHandler` to produce the HTML document this client hydrates. See [server-rendering-and-adapters.md](./server-rendering-and-adapters.md).

### Intermediate — SSG static host

```tsx
// main.tsx
import { createRouterApp } from "kiru/router/ssg"
import { routes } from "./routes"

void createRouterApp({
  routes,
  container: document.getElementById("app")!,
})
```

Vite config sets `router.ssg: true`. Build emits one HTML file per static route.

### Advanced — CSR with i18n and transitions

```tsx
import { createRouterApp } from "kiru/router/csr"
import { createI18nConfig } from "kiru/router"
import { routes } from "./routes"

const i18n = createI18nConfig({
  locales: ["en", "fr"],
  defaultLocale: "en",
  load: {
    en: () => import("./i18n/en.json"),
    fr: () => import("./i18n/fr.json"),
  },
})

void createRouterApp({
  routes,
  container: document.getElementById("app")!,
  i18n,
  transition: true,
  pathPolicy: { baseUrl: "/app", trailingSlash: "never" },
})
```

### Advanced — Hybrid marketing site + dashboard

```ts
// vite.config.ts
import kiru from "vite-plugin-kiru"

export default {
  plugins: [
    kiru({
      router: {
        ssg: true,
        serverEntry: "./src/server.ts",
        remote: "**/*.remote.ts",
      },
    }),
  ],
}
```

- `/`, `/pricing`, `/about` marked `static: true` → prerendered HTML at build.
- `/dashboard/*` rendered on demand by the SSR server.
- Client uses `kiru/router/ssr` bootstrap.

### Advanced — Custom hydrate without `createRouterApp`

```tsx
import { bootstrapSsrClient } from "kiru/ssr/router"
import { routes } from "./routes"

const app = await bootstrapSsrClient({
  routes,
  container: document.getElementById("app")!,
  hydrateOptions: {
    onRecoverableError(error) {
      console.warn("Hydration mismatch", error)
    },
  },
})

// later
app.unmount()
```

Use when you need fine-grained control over hydrate options or must coordinate bootstrap with other client initialization.

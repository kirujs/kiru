# Migration from `main` — FileRouter to v2 route tree

For teams on `main` with **FileRouter** / Vike-style sandbox code. This branch deletes filesystem routing in favor of explicit `routes.ts`.

## High-level steps

1. Add `src/routes.ts` with `createRouteTree`.
2. Move pages from `pages/**/+Page.tsx` to normal modules referenced by `r.page`.
3. Replace guard exports with `routeMiddleware` + `meta`.
4. Pick bootstrap: `kiru/router/csr` | `ssg` | `ssr`.
5. Update `vite.config` with `router.ssg` / `router.serverEntry` as needed.
6. Replace server boilerplate with `createKiruResponder` or `createRenderer`.
7. Remove FileRouter / `+config.ts` / `+onRenderHtml` files.

## API mapping

| v1 / main pattern | v2 replacement |
|-------------------|----------------|
| FileRouter | `createRouteTree` + `compileRouteTree` |
| `pages/foo/+Page.tsx` | `createRoute("/foo", () => import("./pages/foo.tsx"))` |
| `+layout.tsx` | `createRouteScope({ layout: () => import(...) })` |
| `+route.ts` config | `static`, `head`, `meta` on `r.page` / scope |
| `beforeEach` / `beforeEnter` | `routeMiddleware` |
| `beforeActivate` | Remove or use middleware (ran too late) |
| Vike `+onRenderHtml` | `createRenderer` / adapter |
| Vike `+onRenderClient` | `createRouterApp` from `kiru/router/ssr` |
| Client manifest plugin option | Vite `build.manifest` |
| Per-page data hooks (if any) | `export const load = loader(...)` |
| Env-only CSR | unchanged import `kiru/router/csr` |

## Server migration sketch

### Before (conceptual FileRouter / manual)

```ts
// ad-hoc render hook per request
```

### After

```ts
import { createKiruResponder } from "@kirujs/adapter-node"
import { routes } from "./routes.js"

const kiru = createKiruResponder({
  importMetaUrl: import.meta.url,
  routes,
  stream: true,
})

export default { fetch: kiru.fetch }
```

```ts
// client.ts
import { createRouterApp } from "kiru/router/ssr"

void createRouterApp({
  routes,
  container: document.getElementById("app")!,
})
```

## Hybrid SSG + SSR (formerly separate concerns)

On `main`, SSG and SSR may have been separate plugin paths. On v2:

```ts
kiru({
  router: {
    ssg: true,
    serverEntry: "./src/server.ts",
  },
})
```

Pass `prerenderedHtmlDir` via adapter (auto from `clientDir` in production).

## Loader migration

| Old mental model | v2 export |
|------------------|-----------|
| Client-only fetch in `onMounted` | `clientLoader` |
| Server props | `serverLoader` or `loader` |
| Build-time props | `staticLoader` + `static: true` |

Add `PageProps<typeof load>` to page components.

## Auth migration

| Old | v2 |
|-----|-----|
| Guard reading global store | `RouteMiddleware` + `ctx.context` |
| SSR without guards | Same middleware on `createRenderer` |
| Client-only session | SSR `getRequestContext` + hydration; client session API planned |

Augment `RouteMeta` and `CustomRequestContext`.

## Remote action handler context

Handlers use **`RemoteActionHandlerArgs<Body, Query>`** (`{ body, query, context, signal, execution? }`). Configured actions use a single config object with `handler`, `validation: { body?, query? }`, and optional `middleware` (failures via `throw new RemoteError(...)`). Calls use **`RemoteActionCallOptions`** (`{ body?, query?, signal? }`; omit options for void GET/POST).

```ts
action.post({
  validation: { body: schema, query: querySchema },
  middleware: [requireAuth],
  handler: async ({ context, body, query }) => { ... },
})
await createTodo({ body: { title: "x" }, signal })
await search({ query: { q: "kiru" } })
await runPipeline()  // void POST / GET — no `{}` required
```

Form posts: `async ({ formData, context, signal }) =>`. Form + schema: parsed fields on `body`. Client abort: `action.get({ signal })`, `action.post({ body, signal })`.

**SSR scope:** `runWithSsrRequestContext` wraps sync `headlessRender` only (single `current` slot, save/restore on nest). RPC uses the token, not that slot. Add `import "virtual:kiru:remote-registry"` to `serverEntry` for production action registration.

**SSG:** `prerenderStaticRoutes({ signal })` and `maxConcurrentRenders: Infinity` run all pages in parallel (fixed from an earlier sequential `Infinity` bug).

## Breaking removals checklist

- [ ] Replace `validateSearch` / `defineSearchParams` / `KiruValidator` with `load.validation` + `Schema` / `parseInput`
- [ ] Update `<Link prefetch="hover">` to `prefetch={{ trigger: "hover" }}` or omit for defaults
- [ ] Update `*.actions.ts` to `{ body, query, context, signal }` envelope; config with `handler` + `validation`; calls `{ body }` / `{ query }` / `()`
- [ ] Delete `FileRouter` imports
- [ ] Delete `+Page.tsx` / `+config.ts` Vike files
- [ ] Remove `e2e/ssr-bun` / `e2e/ssr-worker` if referenced in CI — use `ssr-matrix`
- [ ] Update `builderman.js` tasks (`e2e/ssg` restored on branch)
- [ ] Replace `RouterView`-only mount with `createRouterApp` for SSR apps
- [ ] Configure `KIRU_ACTIONS_SECRET` when using remote actions
- [ ] `import "virtual:kiru:remote-registry"` in SSR `serverEntry` when using `router.remote`

## Sandbox reference

`main` sandbox used Vike renderer files — deleted on branch.

**New canonical sandbox:** `sandbox/ssr/` (`routes.ts`, `server/index.ts`, `routeMiddleware.ts`).

Compare:

```bash
git diff main...HEAD -- sandbox/ssr/
```

## Verification commands

```bash
# Unit
npm test -w @kirujs/lib

# E2E (see builderman.js)
node builderman.js  # csr, ssg, ssr, ssr-matrix tasks
```

## Staged adoption

1. **CSR first** — port tree + middleware; ship `kiru/router/csr`.
2. **Add SSR** — `serverEntry`, swap client to `kiru/router/ssr`, add `serverLoader` where needed.
3. **Add SSG slice** — mark marketing routes `static: true`, enable `router.ssg`.

Partial SSG does not require new APIs — see [05-rendering-modes.md](./05-rendering-modes.md).

## Documentation cross-links

After migration, public docs should point to:

- [docs/v2/README.md](./README.md) — internal deep-dive index
- [docs/router/deploy-runtimes.md](../router/deploy-runtimes.md) — production
- [docs/router/route-middleware-and-context.md](../router/route-middleware-and-context.md) — auth patterns

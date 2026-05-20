# Actions, forms, and remote functions

Server mutations flow through **remote actions** (`packages/lib/src/remote/action.ts`) integrated into `createRenderer`. Vite transforms client stubs via `router.remote` glob.

## `action.post` / `action.get`

```ts
import { action } from "kiru/remote"
import { z } from "zod"

const createTodo = action.post(
  z.object({ title: z.string() }),
  async ({ context, signal }, input) => {
    if (signal.aborted) throw new DOMException("Aborted", "AbortError")
    await db.todos.create({ ...input, userId: context.user?.id })
    return { ok: true }
  },
  {
    invalidate: ["route:todos"],
    revalidate: { tags: ["todos"] },
  }
)
```

- Validates with Standard Schema (`parseInput`)
- SSR: `runWithSsrRequestContext` around sync render only (save/restore `current` scope)
- Client: `resource(createTodo)` or generated stub → `fetch("/?action=...")`

### Invalidation

Successful responses may include `x-kiru-invalidate` header → client `router.loaderEpoch` bumps → loaders refetch (`applyInvalidateResponseHeader`).

## Form actions

```ts
export const submitContact = action.post(schema, handler)

// Page:
import { createFormController, formAction } from "kiru/forms"
```

**Progressive enhancement:**

- Native submit → `303` redirect (traditional)
- Enhanced (`x-kiru-form` header) → JSON body with `redirect`, `fieldErrors`

Branch fix: `createFormController` sends `x-kiru-form` so validation errors return JSON (E2E form-action specs in `e2e/ssr`).

## Renderer `actions` option

```ts
createRenderer({
  routes,
  actions: {
    secret: process.env.KIRU_ACTIONS_SECRET!,
    allowedOrigins: ["https://myapp.com"],
  },
})
```

Signs context token in HTML; validates on `POST /?action=`.

**CSR/SSG:** `guardRemoteActionOnClient` throws — remote actions require SSR bootstrap + server.

## Vite remote registry

```ts
// vite.config.ts
kiru({
  router: {
    serverEntry: "./src/server.ts",
    remote: "**/*.actions.ts",
  },
})
```

Plugin:

1. Transforms matching files to client fetch stubs in dev/build
2. Emits `virtual:kiru:remote-registry` — **import it from your `serverEntry`** so production bundles register handlers:

```ts
import "virtual:kiru:remote-registry"
```

Dev middleware loads the same modules via `loadRemoteRegistry`; without the import, prod `POST /?action=` returns 500.

## Action handler context

Handlers receive **`RemoteActionContext`**: `{ context, signal }`.

- **`context`** — your `CustomRequestContext` (session, auth, etc.)
- **`signal`** — aborts when the HTTP request is cancelled (client disconnect, `fetch` abort, or SSR render abort)

`action.get` / `action.post` still accept a zero-arg callback when you do not need either field.

Client calls may pass `{ signal }` as the last argument (GET) or second argument (POST); the server wires `Request.signal` into the handler.

## SSR context threading

```ts
runWithSsrRequestContext(ctx, renderSignal, () => { /* sync headlessRender */ })
__getSsrRequestContext()  // CustomRequestContext during that sync pass only
__getSsrActionContext()   // full { context, signal }
```

Context is set only for **synchronous** render (`headlessRender` / streaming shell). The renderer wraps each sync shell in `runWithSsrRequestContext`; nested calls save/restore a single module-level `current` slot (not a stack, not ALS).

| When | Context source |
|------|----------------|
| Sync render / first tick of `action()` on server | `current` scope (`__getSsrRequestContext`) |
| After `await` inside the action wrapper | Snapshot taken **before** `await validateActionInput` |
| HTTP `/?action=` RPC | Signed token in `x-kiru-token` + `Request.signal` |

Do not `await` inside the `runWithSsrRequestContext` callback — other requests may run between your awaits and the slot will belong to them.

Ensures inline `resource(action)` during SSR sees real session and the active render abort signal.

## Security checklist for docs

| Topic | Guidance |
|-------|----------|
| Secret rotation | `KIRU_ACTIONS_SECRET` env |
| CSRF | Token in `x-kiru-token` tied to serialized context |
| Origins | `allowedOrigins` on renderer |
| Auth | Load user in `getRequestContext`; check in action handler |

## Use-case examples

### Todo create + list refresh

```ts
action.post(schema, handler, { invalidate: ["route:todo-list"] })
```

### On-demand ISR after CMS publish

```ts
action.post(schema, async ({ context, signal }, body) => {
  if (signal.aborted) throw new DOMException("Aborted", "AbortError")
  await save(body, { userId: context.user?.id })
}, { revalidate: { paths: ["/blog"], tags: ["blog"] } })
```

### Contact form with field errors

```tsx
const form = createFormController(submitContact, { defaultValues: { email: "" } })
// Render field errors from JSON response
```

### GET action (read-only RPC)

```ts
export const getStats = action.get(async ({ context }) => ({
  count: await db.count({ userId: context.user?.id }),
}))
```

## Testing

- Unit: `packages/lib/src/tests/unit/*action*`, `ssrRequestContext.test.ts` (scope save/restore, concurrent renders)
- E2E: `e2e/ssr` Cypress invalidate-after-action, form redirect flows; `cy.task("concurrentContextCheck")` and `scripts/concurrent-request-context.mjs` (32 parallel GETs + RPC, distinct `x-e2e-user-name` on `/context-concurrency`)

## Related

- [07-isr-prerender-cache.md](./07-isr-prerender-cache.md) — `revalidate` meta on actions
- [03-loaders-and-data.md](./03-loaders-and-data.md) — `invalidate` route ids

# Actions, forms, and remote functions

Server mutations flow through **remote actions** (`packages/lib/src/remote/action.ts`) integrated into `createRenderer`. Vite transforms client stubs via `router.remote` glob.

## `action.post` / `action.get`

```ts
import { action } from "kiru/remote"
import { z } from "zod"

const createTodo = action.post(
  z.object({ title: z.string() }),
  async (ctx, input) => {
    await db.todos.create({ ...input, userId: ctx.user?.id })
    return { ok: true }
  },
  {
    invalidate: ["route:todos"],
    revalidate: { tags: ["todos"] },
  }
)
```

- Validates with Standard Schema (`parseInput`)
- SSR: runs with `__setSsrRequestContext` during render
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
2. Emits `virtual:kiru:remote-registry` for server bundle to register handlers

## SSR context threading

```ts
__setSsrRequestContext(ctx)  // before sync render
__getSsrRequestContext()       // inside action.invoke during render
```

Ensures inline `resource(action)` during SSR sees real session, not `{}`.

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
action.post(schema, async (ctx, body) => {
  await save(body)
}, { revalidate: { paths: ["/blog"], tags: ["blog"] } })
```

### Contact form with field errors

```tsx
const form = createFormController(submitContact, { defaultValues: { email: "" } })
// Render field errors from JSON response
```

### GET action (read-only RPC)

```ts
export const getStats = action.get(async (ctx) => ({ count: await db.count() }))
```

## Testing

- Unit: `packages/lib/src/tests/unit/*action*`
- E2E: `e2e/ssr` Cypress invalidate-after-action, form redirect flows

## Related

- [07-isr-prerender-cache.md](./07-isr-prerender-cache.md) — `revalidate` meta on actions
- [03-loaders-and-data.md](./03-loaders-and-data.md) — `invalidate` route ids

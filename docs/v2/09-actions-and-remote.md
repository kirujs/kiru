# Actions, forms, and remote functions

Server mutations flow through **remote actions** (`packages/lib/src/remote/action.ts`) integrated into `createRenderer`. Vite transforms client stubs via `router.remote` glob.

## HTTP verbs

| Factory | `fetch` method | Input |
|---------|----------------|-------|
| `action.get` | `GET` | none (options only) |
| `action.post` | `POST` | JSON body |
| `action.put` | `PUT` | JSON body |
| `action.patch` | `PATCH` | JSON body |
| `action.delete` | `DELETE` | JSON body (optional) |

Form actions use `action.post({ type: "form" }, …)` only (`POST` + multipart/urlencoded).

## `action.post` / `action.get`

```ts
import { action } from "kiru/remote"
import { z } from "zod"

const createTodo = action.post(
  {
    schema: z.object({ title: z.string() }),
    invalidate: ["route:todos"],
    revalidate: { tags: ["todos"] },
  },
  async ({ context, signal, input }) => {
    if (signal.aborted) throw new DOMException("Aborted", "AbortError")
    await db.todos.create({ ...input, userId: context.user?.id })
    return { ok: true }
  }
)

// Simple JSON RPC (no config object)
export const echo = action.post(async ({ input }) => ({ echo: input }))
```

- Validates with Standard Schema (`parseInput`)
- SSR: `runWithSsrRequestContext` around sync render only (save/restore `current` scope)
- Client: `resource(createTodo)` or generated stub → `fetch("/?action=...")`

### Invalidation

Successful responses may include `x-kiru-invalidate` header → client `router.loaderEpoch` bumps → loaders refetch (`applyInvalidateResponseHeader`).

## Form actions

```ts
import { action, createFormController } from "kiru/remote"

export const submitContact = action.post({ type: "form" }, async ({ formData }) => {
  // or { schema, type: "form" } for parsed input (File fields supported)
  return { ok: true }
})

// Page:
const form = createFormController(submitContact)
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

## Action handler args and call envelope

Handlers receive a single **`RemoteActionHandlerArgs<Input>`** object:

```ts
type RemoteActionHandlerArgs<Input> = {
  input: Input
  context: CustomRequestContext
  signal: AbortSignal
  execution?: ActionExecution
}
```

- **`context`** — your `CustomRequestContext` (session, auth, etc.)
- **`signal`** — aborts when the HTTP request is cancelled (client disconnect, `fetch` abort, or SSR render abort)
- **`input`** — validated JSON body (`void` for GET / no-input POST)
- **`execution`** — request runtime (frames, cache, tracing) during RPC and nested composition

**Client / server calls** use one options envelope (never positional `(input, opts)`):

```ts
await runPipeline()                        // void / GET — options may be omitted
await runPipeline({ signal: ac.signal })
await api.removeLabel({ input: "demo" })   // body actions — `{ input }` required
await api.getEcho({ signal })
```

Form handlers use **`RemoteFormActionHandlerArgs`**: `{ formData, context, signal, execution? }` (or `{ formData, … }` plus `input` when `{ type: "form", schema }` parses fields).

## Namespaced exports

Group related actions in objects; RPC ids use **dot paths** (file hash + path, not URL shape):

```ts
export const users = {
  get: action.get(async ({ context }) => { /* … */ }),
  delete: action.delete(async ({ input: id }) => { /* … */ }),
}

export const admin = {
  users: {
    ban: action.post(async ({ context, input }) => { /* … */ }),
  },
}
```

Client stubs preserve the object shape (`users.get`, `admin.users.ban`). Nested object literals only (no computed keys or re-exports).

## Calling actions inside actions

On the server, `await users.get(id)` from another handler runs **in-process** via `__kiruInvoke` with the same signed request context (no nested HTTP). Context is tracked with **AsyncLocalStorage** and a **linked frame stack** so concurrent requests do not clobber each other.

### Execution model

```ts
type ActionExecutionFrame = {
  actionId: string
  parent?: ActionExecutionFrame
  startedAt: number
  endedAt?: number
  meta?: Record<string, unknown>
}

type RequestExecutionContext = {
  requestId: string
  request: Request
  response?: Response
  context: CustomRequestContext
  signal: AbortSignal
}

type ActionRuntimeContext = {
  rootFrame: ActionExecutionFrame
  currentFrame: ActionExecutionFrame
  cache: CacheScope      // request-local memo (dedupe nested calls)
  tracing: TraceContext  // spans / flamegraphs later
  transaction?: Transaction
}

type ActionExecution = {
  request: RequestExecutionContext
  runtime: ActionRuntimeContext
}
```

Use `execution?.runtime.cache.memo(key, fn)` for in-request dedupe; `execution?.runtime.currentFrame` for the innermost frame.

```ts
export const users = {
  get: action.get(async ({ context }) => context.user),
}

export const updateProfile = action.post(async () => {
  const user = await users.get()
  return { ok: true, was: user?.name }
})
```

### Invalidation and `revalidate` on nested calls

**Current behavior:** `invalidate` and `revalidate` on an action run only when that action is the **HTTP entry** — the handler registered for `/?action=…` whose response is built in `invokeJsonRemoteAction` / the form-action branch. Nested `await otherAction()` calls use in-process `__kiruInvoke`; they do not emit `x-kiru-invalidate` or call `applyServerRevalidate` for their own meta.

**Why (today):**

- The client performs one RPC; cache side effects are tied to that single response.
- Nested calls are composition (shared server logic), not separate endpoints.
- Revalidate / invalidate are implemented in the transport layer after the outer handler returns, not inside every `__kiruInvoke`.

**Practical guidance:** Put `invalidate` / `revalidate` on the action you expose to the client, or run shared revalidation once in that handler after composed work succeeds.

**Design note (open):** It is not settled whether nested actions should automatically contribute meta (e.g. merge child `invalidate` / `revalidate` into the outer response, or run ISR purge when an inner composed action defines tags). If that becomes desirable, it would be an explicit runtime change — not the behavior today. Until then, do not rely on meta attached only to a nested action that is never called directly over HTTP.

## SSR context threading

```ts
runWithSsrRequestContext(ctx, renderSignal, () => { /* sync headlessRender */ })
__getSsrRequestContext()  // CustomRequestContext during that sync pass only
__getSsrActionContext()   // RemoteActionHandlerArgs<void> ({ input: undefined, context, signal })
```

Context is set only for **synchronous** render (`headlessRender` / streaming shell). The renderer wraps each sync shell in `runWithSsrRequestContext`; nested calls save/restore a single module-level `current` slot (not a stack, not ALS).

| When | Context source |
|------|----------------|
| Sync render / first tick of `action()` on server | `current` scope (`__getSsrRequestContext`) |
| After `await` inside the action wrapper | Snapshot taken **before** `await validateActionInput` |
| HTTP `/?action=` RPC | Signed token in `x-kiru-token` + `Request.signal` (ALS while handler runs) |

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
action.post(
  { schema, invalidate: ["route:todo-list"] },
  handler
)
```

### On-demand ISR after CMS publish

```ts
action.post(
  {
    schema,
    revalidate: { paths: ["/blog"], tags: ["blog"] },
  },
  async ({ context, signal, input }) => {
    if (signal.aborted) throw new DOMException("Aborted", "AbortError")
    await save(input, { userId: context.user?.id })
  }
)
```

### Contact form with field errors

```tsx
const form = createFormController(submitContact)
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

# Actions, forms, and remote functions

Server mutations flow through **remote actions** (`packages/lib/src/remote/action.ts`) integrated into `createRenderer`. Vite transforms client stubs via `router.remote` glob.

## HTTP verbs

| Factory | `fetch` method | Wire format |
|---------|----------------|-------------|
| `action.get` | `GET` | query string on `/?action=…` |
| `action.post` | `POST` | JSON body + optional query string |
| `action.put` | `PUT` | JSON body + optional query string |
| `action.patch` | `PATCH` | JSON body + optional query string |
| `action.delete` | `DELETE` | JSON body (optional) + optional query string |

Form actions use `action.post({ type: "form" }, …)` only (`POST` + multipart/urlencoded).

## `action.post` / `action.get`

```ts
import { action } from "kiru/remote"
import { z } from "zod"

const createTodo = action.post({
  validation: { body: z.object({ title: z.string() }) },
  middleware: [requireAuth],
  invalidate: ["route:todos"],
  revalidate: { tags: ["todos"] },
  handler: async ({ context, signal, body }) => {
    if (signal.aborted) throw new DOMException("Aborted", "AbortError")
    await db.todos.create({ ...body, userId: context.user?.id })
    return { ok: true }
  },
})

// GET with query validation
export const search = action.get({
  validation: { query: z.object({ q: z.string() }) },
  handler: async ({ query }) => findAll(query.q),
})

// Simple JSON RPC (bare handler)
export const echo = action.post(async ({ body }) => ({ echo: body }))
```

- Validates with Standard Schema (`parseInput`) on `validation.body` / `validation.query`
- Middleware runs before validation; reject with `return fail({ status: 401, message: "…", code: "UNAUTHORIZED" })`
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
- Enhanced (`x-kiru-form` header) → JSON with `__kiruRedirect`, `__kiruFail`, or success payload

`createFormController` sends `x-kiru-form` so validation errors return JSON (E2E form-action specs in `e2e/ssr`). On `fail()`, the controller sets `fieldErrors` from `fields` and `message` for non-field errors (e.g. auth banner).

## Expected failures: `fail()`

Use **`return fail({ message, status?, code?, fields?, data? })`** for expected failures on **both** form actions and JSON RPC — same wire marker (`__kiruFail`), same HTTP status rules.

| Situation | Default HTTP status |
|-----------|---------------------|
| `fail()` with non-empty `fields` (undefined keys stripped) | **422** |
| `fail()` without `fields` | **400** |
| Explicit `status` | Always wins (e.g. `401`) |

```ts
import { action, fail } from "kiru/remote"

// Form validation
if (!username) {
  return fail({
    message: "Invalid login",
    status: 422,
    fields: { username: "Required" },
  })
}

// JSON auth
if (!context.user) {
  return fail({ status: 401, message: "Sign in required", code: "UNAUTHORIZED" })
}
```

Wire JSON (enhanced form and JSON RPC):

```json
{
  "__kiruFail": true,
  "message": "Invalid credentials",
  "status": 401,
  "code": "AUTH_FAILED",
  "fields": { "username": "Unknown user or wrong password" }
}
```

- **JSON client:** `dispatch` throws **`ActionFailure`** (`isActionFailure`, `status`, `message`, `code?`, `fields?`, `data?`). Legacy `{ error: { … } }` envelopes are still recognized for one release.
- **Forms:** parse `__kiruFail` before checking `res.ok` so custom statuses (e.g. `401`) work on enhanced submits.
- **Exceptions:** `throw new Error()` → `500`. Do not use `RemoteError` in app code (internal migration only).

## Response metadata (cookies, token refresh)

Handlers can attach **Set-Cookie** and refresh the signed RPC context on the HTTP response. The framework serializes cookies and signs tokens — handlers do not set raw response headers.

### `redirect` with cookies and context

```ts
import { action, redirect } from "kiru/remote"

export const login = action.post({ type: "form" }, async ({ formData }) => {
  const user = await authenticate(formData)
  const sessionId = await createSession(user.id)
  return redirect(303, "/app", {
    cookies: [
      {
        name: "session",
        value: sessionId,
        path: "/",
        maxAge: 604800,
        httpOnly: true,
        sameSite: "Lax",
      },
    ],
    context: { user }, // signed into x-kiru-token on the response
  })
})
```

| Transport | Redirect body | Cookies / token |
|-----------|---------------|-------------------|
| Native form POST | `303` + `Location` | `Set-Cookie`, optional `x-kiru-token` |
| Enhanced form (`x-kiru-form`) | JSON `{ __kiruRedirect, status, location }` | Response headers (browser applies cookies before `location.assign`) |
| JSON RPC (`action.post`, etc.) | Same JSON redirect shape | Same response headers |

### `actionResult` (success without redirect)

```ts
import { action, actionResult } from "kiru/remote"

export const refreshSession = action.post(async () => {
  const user = await loadUser()
  return actionResult({ ok: true }, {
    cookies: [/* … */],
    context: { user },
  })
})
```

The client receives the unwrapped `value` in JSON. `createFormController` excludes `KiruRedirect`, `KiruActionResult`, and `KiruActionFail` from the reactive `result` type.

### Client behavior

After a successful enhanced form or JSON action fetch, the client calls `applyActionResponseHeaders`:

- `x-kiru-invalidate` → `router.invalidate`
- `x-kiru-token` → updates `requestToken` for subsequent `/?action=` and `/?loader=` calls

**Important:** Token refresh uses the **`context` you pass in metadata**, not a re-run of `getRequestContext` on the same request. The incoming `Cookie` header is unchanged until the browser stores the new cookies and you navigate or issue another document request.

For login flows that redirect, the next document SSR run reads cookies via `getRequestContext` and emits a fresh `k-request-token` in HTML — that is usually enough without relying on `x-kiru-token` on the action response.

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

Handlers receive a single **`RemoteActionHandlerArgs<Body, Query>`** object:

```ts
type RemoteActionHandlerArgs<Body, Query = void> = {
  body: Body
  query: Query
  headers: Record<string, string>
  context: CustomRequestContext
  signal: AbortSignal
}
```

- **`context`** — your `CustomRequestContext` (session, auth, etc.)
- **`signal`** — aborts when the HTTP request is cancelled (client disconnect, `fetch` abort, or SSR render abort)
- **`body`** — validated JSON body (`void` for GET / no-body POST)
- **`query`** — validated query (`void` when no `validation.query`)
- **`headers`** — incoming request headers (lowercase keys; first value when duplicated)
- **Runtime (frames, cache, tracing)** — use `getActionExecutionContext()` inside handlers; not on callback args

**Client / server calls** use one options envelope:

```ts
await runPipeline()                              // void body/query — options may be omitted
await runPipeline({ signal: ac.signal })
await api.removeLabel({ body: "demo" })          // body actions — `{ body }` when typed
await search({ query: { q: "kiru" }, signal }) // GET with query schema
```

Form handlers use **`RemoteFormActionHandlerArgs`**: `{ formData, headers, context, signal }` (or `{ formData, … }` plus `body` when `{ type: "form", schema }` parses fields).

## Namespaced exports

Group related actions in objects; RPC ids use **dot paths** (file hash + path, not URL shape):

```ts
export const users = {
  get: action.get(async ({ context }) => { /* … */ }),
  delete: action.delete(async ({ body: id }) => { /* … */ }),
}

export const admin = {
  users: {
    ban: action.post(async ({ context, body }) => { /* … */ }),
  },
}
```

Client stubs preserve the object shape (`users.get`, `admin.users.ban`). Nested object literals only (no computed keys or re-exports).

### Default export

You can default-export action namespaces or a single action. RPC ids use the **`default`** prefix (`default.get`, `default.getEcho`), not the file name.

**Anonymous default** (SSR injects `__kiru_default` for registry refs):

```ts
export default {
  get: action.get(async ({ context }) => { /* … */ }),
}
```

**Linked const** (recommended when the same file calls actions in-process or you want a stable local binding). The `const` must appear **before** `export default` in the file:

```ts
const users = {
  get: action.get(async ({ context }) => { /* … */ }),
}
export default users

export const runPipeline = action.post(async () => {
  return users.get()
})
```

On the client, `import users from "./page.actions"` works for both patterns. Server registry refs stay `users.get` for the linked form; anonymous default uses `__kiru_default.get` after transform.

Use `export const users = { … }` when you want RPC ids `users.*` instead of `default.*`, or named imports without default.

## Calling actions inside actions

On the server, `await users.get(id)` from another handler runs **in-process** via `__kiruInvoke` with the same signed request context (no nested HTTP). Context is tracked with **AsyncLocalStorage** and a **linked frame stack** so concurrent requests do not clobber each other.

### Execution model

```ts
type RequestEnvelope = {
  body?: unknown
  query?: Record<string, unknown>
  headers: Headers
  context: CustomRequestContext
  requestId: string
  signal: AbortSignal
  raw: Request
}

type RuntimeContext = {
  cache: CacheScope
  tracing: TraceContext
  transaction?: Transaction
  middleware: { locals: Record<string, unknown> }
}

type ExecutionState = {
  rootFrame: ActionExecutionFrame
  currentFrame: ActionExecutionFrame
}

type ActionExecution = {
  request: RequestEnvelope
  runtime: RuntimeContext
  execution: ExecutionState
}
```

`ActionExecution` lives in **AsyncLocalStorage** during RPC/nested calls only. Handlers use flat args; read ALS via `getActionExecutionContext()`:

```ts
const ex = getActionExecutionContext()
ex?.runtime.cache.memo(key, fn)           // in-request dedupe
ex?.execution.currentFrame               // innermost frame
```

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
__getSsrActionContext()   // RemoteActionHandlerArgs<void, void> ({ body/query undefined, context, signal })
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
action.post({
  validation: { body: schema },
  invalidate: ["route:todo-list"],
  handler,
})
```

### On-demand ISR after CMS publish

```ts
action.post({
  validation: { body: schema },
  revalidate: { paths: ["/blog"], tags: ["blog"] },
  handler: async ({ context, signal, body }) => {
    if (signal.aborted) throw new DOMException("Aborted", "AbortError")
    await save(body, { userId: context.user?.id })
  },
})
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

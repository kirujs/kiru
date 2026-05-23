# Remote actions

Remote actions are Kiru’s **mutation layer** — server functions invoked from the client over HTTP, with codegen splitting server implementation from browser stubs. They overlap conceptually with Next.js Server Actions and SvelteKit form actions.

Implementation hub: [`packages/lib/src/remote/`](../../packages/lib/src/remote/).

---

## Authoring

### Action modules

Vite `router.remote` glob (e.g. `"*.actions.ts"`) triggers codegen ([`vite-plugin-kiru/src/codegen/remote.ts`](../../packages/vite-plugin-kiru/src/codegen/remote.ts)):

- Server bundle registers handlers in `virtual:kiru:remote-registry`
- Client bundle gets fetch stubs calling `__kiru_serverActions.dispatch`

Patterns (e2e `default-export-demo`):

| Pattern | Description |
|---------|-------------|
| Named exports | `export const myAction = action(...)` |
| Default export object | `export default { login, logout }` |
| Linked actions file | `page.tsx` imports from `./page.actions.ts` |

### Defining actions

Use `action` from `kiru/remote` — a **single callable** (no `action.get` / `action.post` / HTTP verbs in the API).

#### JSON RPC (always POST on the wire)

```ts
// Shorthand
export const updateUser = action(async ({ body, context, cookies, headers }) => {
  if (!context.user) {
    return { ok: false, error: { message: "Sign in required", code: "UNAUTHORIZED" } }
  }
  context.user = updated
  cookies.set("session", sessionId, { path: "/" })
  headers.set("x-custom", "1")
  return { user: updated }
})

// Config object (validation, middleware, invalidate meta)
export const search = action({
  validation: { query: searchQuerySchema },
  handler: async ({ query }) => findItems(query),
})
```

- **Return value:** whatever JSON shape you choose — serialized as-is on the wire (no framework `{ ok, data }` wrapper).
- **Redirects (JSON handlers):** `import { redirect }` and `return redirect(status, location, options?)` — special-cased to `{ __kiruRedirect: true, status, location }`; client navigates via `location.assign`.
- **Thrown `RemoteError`:** framework responds with **HTTP status only** (empty body). Client `dispatch` throws `ActionDispatchError`.
- **Response side effects** on handler args (committed on normal return, rolled back on throw):
  - `context` — mutable clone of request context; diff → `x-kiru-token` refresh header.
  - `headers` — outgoing `Headers` for the action response.
  - `cookies` — `ActionCookies` (`set` / `get` / `delete`) with overridable defaults.

#### Form actions (multipart / urlencoded POST)

```ts
export const login = action({
  type: "form",
  handler: async ({ formData, context, cookies, redirect }) => {
    // ...
    return redirect(303, "/todos")
  },
})

export const addTodo = action({
  type: "form",
  validation: { body: addTodoSchema },
  handler: async ({ body, context }) => ({ todo: body }),
})
```

- Single config object with **`handler`** (no second callback argument).
- **`validation: { body }`** for parsed form fields (not a separate `schema` key).
- **`redirect`** is on **form handler args** only — do not import `redirect` for form handlers.

---

## Client + wire

### JSON RPC

- **HTTP `POST`** `/?action=<encodedActionId>[&query params]`
- **JSON body** — `null` when empty (`JSON.stringify` on the client)
- Query parameters still used when `validation.query` is configured
- Response: **HTTP 200** + `JSON.stringify(handlerReturn)` (except redirects)
- Low-level `dispatch(id, call?)` — no HTTP method argument
- Typed action stubs return **`Promise<Output>`** directly from codegen
- **Non-2xx** responses throw `ActionDispatchError`

### Forms

- Native or enhanced form **POST** (separate from JSON RPC)
- Enhanced form POST (`x-kiru-form`) uses **HTTP 200** + JSON body (same redirect marker as RPC)
- Native HTML form POST (no `x-kiru-form`) still **303-redirects** to the referer on non-redirect success; use enhanced forms for in-page result handling

Client dispatch ([`routerHydrate.ts`](../../packages/lib/src/ssr/routerHydrate.ts) / `ensureServerActionsClient`):

- Header `x-kiru-token` — signed request context
- `Content-Type: application/json` on RPC calls
- Parses JSON body or redirect marker; applies `applyActionResponseHeaders` for invalidate + token refresh

Server: `createRemoteActionHandler` in renderer `prepareRenderer` when `actions: { secret, allowedOrigins?, exposeErrors? }` is set.

---

## Request context & security

### Context token

- Serialized in HTML: `<script type="application/json" k-request-token>`
- `makeKiruContextToken` / `makeKiruContextTokenAsync` (edge Web Crypto)
- Validated on each action/loader POST

**Edge:** Sync token script throws on Cloudflare — use `serializeKiruRequestTokenScriptAsync` in async HTML assembly.

### Origin allowlist

`RendererActionsOptions.allowedOrigins` — exact origin strings; `"*"` disables check.

Failed check → **403** with empty body.

### CSRF model

Actions use:

- Same-site fetch from hydrated app
- Token header tied to serialized context
- Optional Origin/Referer validation

Document for security reviewers: not classic cookie double-submit; relies on **secret-signed context** + origin policy. Teams with strict CSRF policies should review against internal standards.

Full threat model: **`docs/v2/SECURITY.md`** (Sprint 5). Form POST uses the same `allowedOrigins` check as JSON RPC ([`remote/index.ts`](../../packages/lib/src/remote/index.ts)).

---

## Cookies on responses

`ActionCookies` / `KiruSetCookie` — structured Set-Cookie on action success.

Example: `sandbox/ssr` login/logout — `sessionCookieSpec`, `cookies.set(...)` in [`login.actions.ts`](../../sandbox/ssr/src/pages/login.actions.ts).

Adapter/renderer must pass through `Set-Cookie` headers on action responses (handled in remote handler chain).

---

## Forms

`createFormController` ([`remote/formController.ts`](../../packages/lib/src/remote/formController.ts)) — progressive enhancement style:

- Bind forms to action ids
- `result` signal: handler return value or `null`
- `error` signal: transport failure message (non-2xx / parse error)
- SSR vs CSR guard tests: `formController.remote-ssr.test.ts`, `formController.guard-csr.test.ts`

E2E: `e2e/ssr` forms demo pages.

---

## Cache invalidation after mutations

Action response header `x-kiru-invalidate` — comma-separated route ids → `router.invalidate({ routeIds })`.

Pairs with loader cache and SSR outlet refresh (`subscribeSsrClientOutlet` listens to invalidation).

Tests: `actionRevalidate.test.ts`, router global header parsing.

---

## Revalidation integration

Server actions may call `revalidatePath` / `revalidateTag` (Node/Bun only) after mutations — same prerender cache as ISR ([10-isr-hybrid-and-prerender.md](./10-isr-hybrid-and-prerender.md)).

---

## Dev warnings (bootstrap guards)

| Bundle | Calling remote dispatch |
|--------|-------------------------|
| `__KIRU_PURE_CLIENT__` (csr/ssg) | Dev throw — wrong mode |
| `__KIRU_SSR__` | Allowed when server wired |

Files: `devWarnings.remote-csr.test.ts`, `devWarnings.remote-ssr.test.ts`.

---

## Comparison table

| Feature | Kiru remote | Next Server Action | SvelteKit form action |
|---------|-------------|-------------------|----------------------|
| Codegen split | ✅ | ✅ | ✅ |
| App-defined result shapes | ✅ passthrough JSON | ✅ | ✅ |
| Cookie setting | ✅ `ActionCookies` | ✅ | ✅ |
| Non-form fetch | ✅ dispatch | ✅ | ✅ +server |
| Separate API routes | ❌ | ✅ | ✅ +server |

---

## Failure modes to test

1. Expired/invalid context token after logout
2. Action on CSR-only deploy (should fail fast in dev)
3. Concurrent form double-submit
4. Redirect action (`window.location.assign`)
5. `x-kiru-invalidate` + client navigation loader refetch
6. Client checks custom return shape or `catch (ActionDispatchError)` after callable / dispatch

---

## Further reading

- [08-renderer-ssr-and-streaming.md](./08-renderer-ssr-and-streaming.md)
- [05-middleware-and-navigation-guards.md](./05-middleware-and-navigation-guards.md)
- [16-gaps-risks-and-launch-checklist.md](./16-gaps-risks-and-launch-checklist.md)

# Remote actions

Remote actions are Kiru’s **mutation layer** — server functions invoked from the client over HTTP, with codegen splitting server implementation from browser stubs. They overlap conceptually with Next.js Server Actions and SvelteKit form actions.

Implementation hub: `packages/lib/src/remote/`.

---

## Authoring

### Action modules

Vite `router.remote` glob (e.g. `"*.actions.ts"`) triggers codegen (`vite-plugin-kiru/src/codegen/remote.ts`):

- Server bundle registers handlers in `virtual:kiru:remote-registry`
- Client bundle gets fetch stubs calling `__kiru_serverActions.dispatch`

Patterns (e2e `default-export-demo`):

| Pattern | Description |
|---------|-------------|
| Named exports | `export async function myAction(...) { }` |
| Default export object | `export default { login, logout }` |
| Linked actions file | `page.tsx` imports from `./page.actions.ts` |

### Defining actions

Use APIs from `kiru/remote` (see `action.ts`, `actionResponse.ts`, `actionFailure.ts`):

- Success payloads
- **`ActionFailure`** — structured client-safe errors (`isKiruActionFail` wire format)
- **`actionFail`** / **`__kiruFail`** legacy envelope (migration)
- **`actionResponse`** — cookies, context refresh metadata
- Redirects (`isKiruRedirect`)

---

## HTTP surface

Same origin multiplexing as loaders:

```
GET/POST /?action=<encodedActionId>[&query params]
```

Client dispatch (`routerHydrate.ts` / `ensureServerActionsClient`):

- Header `x-kiru-token` — signed request context
- Non-GET sends JSON body
- Parses response; throws `ActionFailure` on fail envelope
- Applies `applyActionResponseHeaders` for invalidate + token refresh

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

Failed check → 403 JSON (see `remote/index.ts`).

### CSRF model

Actions use:

- Same-site fetch from hydrated app
- Token header tied to serialized context
- Optional Origin/Referer validation

Document for security reviewers: not classic cookie double-submit; relies on **secret-signed context** + origin policy. Teams with strict CSRF policies should review against internal standards.

Full threat model: **`docs/v2/SECURITY.md`** (Sprint 5). Form POST uses the same `allowedOrigins` check as JSON actions ([`remote/index.ts`](../../packages/lib/src/remote/index.ts)).

---

## Cookies on responses

`KiruSetCookie` type — structured Set-Cookie on action success (`actionResponse`).

Example: `sandbox/ssr` login/logout — `sessionCookieSpec`, `clearSessionCookieSpec` in `login.actions.ts`.

Adapter/renderer must pass through `Set-Cookie` headers on action responses (handled in remote handler chain).

---

## Forms

`formController` (`remote/formController.ts`) — progressive enhancement style:

- Bind forms to action ids
- SSR vs CSR guard tests: `formController.remote-ssr.test.ts`, `formController.guard-csr.test.ts`
- Works with `ActionFailure` for field-level errors

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
| `__KIRU_PURE_CLIENT__` (csr/ssg) | Dev error — wrong mode |
| `__KIRU_SSR__` | Allowed when server wired |

Files: `devWarnings.remote-csr.test.ts`, `devWarnings.remote-ssr.test.ts`.

---

## Comparison table

| Feature | Kiru remote | Next Server Action | SvelteKit form action |
|---------|-------------|-------------------|----------------------|
| Codegen split | ✅ | ✅ | ✅ |
| Typed failures | ✅ ActionFailure | ✅ | ✅ |
| Cookie setting | ✅ KiruSetCookie | ✅ | ✅ |
| Non-form fetch | ✅ dispatch | ✅ | ✅ |
| Separate API routes | ❌ | ✅ | ✅ +server |

---

## Failure modes to test

1. Expired/invalid context token after logout
2. Action on CSR-only deploy (should fail fast in dev)
3. Concurrent form double-submit
4. Redirect action (`window.location.assign`)
5. `x-kiru-invalidate` + client navigation loader refetch

---

## Further reading

- [08-renderer-ssr-and-streaming.md](./08-renderer-ssr-and-streaming.md)
- [05-middleware-and-navigation-guards.md](./05-middleware-and-navigation-guards.md)
- [16-gaps-risks-and-launch-checklist.md](./16-gaps-risks-and-launch-checklist.md)

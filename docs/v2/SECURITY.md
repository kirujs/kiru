# Security — routing and remote RPC

Threat model and built-in protections for Kiru’s multiplexed HTTP surface (`/?loader=`, `/?action=`) and SSR URL ingress.

Implementation: [`packages/lib/src/router/requestLimits.ts`](../../packages/lib/src/router/requestLimits.ts).

---

## Multiplexed RPC endpoints

When `createRenderer({ actions: { secret, … } })` is configured, the same origin serves:

| Query param | Method | Purpose |
|-------------|--------|---------|
| `?loader=routeId:load` | POST JSON | Client `serverLoader` RPC |
| `?action=routeId:actionName` | POST JSON or form | Remote actions |

Both require a valid **`x-kiru-token`** (or form field `__kiru_form_token`) — HMAC-signed request context from SSR hydration or a prior action response.

---

## Required production configuration

1. **`actions.secret`** — strong, private; rotate by redeploying and invalidating old tokens on full page loads.
2. **`actions.allowedOrigins`** — explicit origin list (e.g. `https://app.example.com`). Avoid `["*"]` in production ([P2-8](../v2/16-gaps-risks-and-launch-checklist.md)).
3. **`actions.requestLimits`** — optional overrides; defaults are suitable for most apps (see table below).

---

## CSRF model

Not classic double-submit cookies. Kiru relies on:

- **Signed context token** bound to the hydrated session
- **Same-site fetch** from the client bundle
- Optional **Origin / Referer** check via `allowedOrigins`

Cookie `SameSite` and session cookies are the application’s responsibility. Teams with strict CSRF policies should review against internal standards.

---

## Request tokens (no framework TTL)

- Tokens do **not** expire by framework policy. Lifetime matches the hydrated page until a full navigation reload or context refresh via **`x-kiru-token`** on successful action responses.
- **`maxTokenLength`** (default 8192) rejects oversized bearer tokens before verify (DoS hardening).
- Session invalidation (logout, idle timeout) is **application responsibility**: clear/mutate `context` server-side, rotate `secret`, or force a document reload.

---

## Ingress request limits (DoS hardening)

Configured via `createRenderer({ actions: { requestLimits?: Partial<KiruRequestLimits> } })` and optionally `createRouter({ requestLimits })` for CSR.

| Limit | Default | Notes |
|-------|---------|-------|
| `maxPathnameLength` | 8192 | SSR GET rejected early (414) before match/middleware |
| `maxSearchLength` | 8192 | Whole query string budget |
| `maxQueryKeys` | 64 | |
| `maxQueryKeyLength` | 256 | |
| `maxQueryValueLength` | 8192 | OAuth `state`, `returnTo`, encoded filters |
| `maxRouteParamLength` | 2048 | **Rejected** — never truncated |
| `maxRouteParamSegments` | 128 | Catch-all `[...]` segments |
| `maxJsonBodyBytes` | 1 MiB | Loader + JSON action RPC (413) |
| `maxFormFields` | 1024 | Best-effort after `formData()` |
| `maxTokenLength` | 8192 | RPC + mint |

**SSR URL guard:** `renderCoreInner` checks pathname/search **before** locale detection, prerender serve, `matchRoute`, middleware, or `loadRouteTree`.

**Loader RPC body:** Only known top-level keys (`params`, `url`, `query`, `context`, `meta`, `route`, `locale`, `locales`, `defaultLocale`). Unknown keys (e.g. `giantPayload`) → 400.

**Route params:** Oversize or over-segmented catch-all params cause **no match** / 400 — path semantics are never silently truncated.

### FormData caveat

`maxFormFields` is enforced **after** `request.formData()`. Runtimes (Node, Bun, Cloudflare Workers) may buffer the full multipart body before field enumeration. **JSON RPC** uses bounded reads; treat FormData limits as best-effort.

### Ingress vs execution

Request limits protect **parsing, matching, and RPC ingress**. They do **not** cap long-running loader/action work.

Use platform timeouts where available:

- Cloudflare Worker CPU/time limits
- Node/Bun server `server.requestTimeout`
- Reverse-proxy `proxy_read_timeout`
- Application-level `AbortSignal` in loaders/actions

---

## Rate limiting

Kiru does not implement per-IP rate limiting. Terminate at the adapter (Wrangler, nginx, CDN, WAF). See [16-gaps-risks-and-launch-checklist.md](./16-gaps-risks-and-launch-checklist.md) (P3-7).

---

## Future API (not implemented)

Per-route or per-action body limits (e.g. `action({ maxBodySize })`) may be added later. v1 uses renderer-level `requestLimits` only; keep overrides in a plain `KiruRequestLimits` object.

---

## Tests (reviewer checklist)

- [`requestLimits.test.ts`](../../packages/lib/src/tests/unit/requestLimits.test.ts)
- [`loaderRegistry.test.ts`](../../packages/lib/src/tests/unit/loaderRegistry.test.ts) — token, body, shape
- [`remote.test.ts`](../../packages/lib/src/tests/unit/remote.test.ts) — token, body, query
- [`formActions.test.ts`](../../packages/lib/src/tests/unit/formActions.test.ts) — `allowedOrigins`

---

## Out of scope

- Request token idle TTL / automatic expiry
- Open-redirect audit on `redirect()` `Location` (follow-up: cap header sizes)
- Per-IP rate limiting inside the framework

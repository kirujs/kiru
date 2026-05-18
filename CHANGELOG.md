# Changelog

All notable changes to this project will be documented in this file.

## Unreleased

### Router

- **Routing:** Fix optional segment `[[param]]` pattern compilation so `/blog` matches without an extra slash; add optional catch-all `[[...param]]` compilation and matching; add unit coverage for catch-all, optional segments, `baseUrl` / `trailingSlash`, and ambiguous route scoring ([`manifest-routing.test.ts`](packages/lib/src/tests/unit/manifest-routing.test.ts)).
- **DX:** Dev-only warnings when `RouterView` is mounted on SSR/SSG HTML without the correct bootstrap, when `serverLoader` runs without loader RPC, and when `staticLoader` is invoked on client navigations.
- **Refactors:** Extract client navigation pipeline to [`navigation.ts`](packages/lib/src/router/navigation.ts) and prerender disk short-circuit to [`prerenderServe.ts`](packages/lib/src/router/prerenderServe.ts) (behavior unchanged).
- **E2E:** SSR form-action progressive enhancement and redirect flows; hybrid `/docs` disk HTML assertion.

### Remote / forms

- **Fix:** `createFormController` sends `x-kiru-form` so enhanced submissions receive JSON (including redirects) instead of native 303 responses.
- **Tests:** Unit coverage for form-action redirect handling (enhanced JSON and native `303`).

### Known limitations

- `serverLoader` on client navigations requires `kiru/router/ssr`, `createRenderer`, and a server loader endpoint (`/?loader=`). Pure CSR/SSG apps should use `loader`, `clientLoader`, or `staticLoader`.
- `CustomRequestContext` is `{}` on pure CSR/SSG. Per-request values are SSR-only via `createRenderer({ context })`; there is no client reactive context API for loaders.

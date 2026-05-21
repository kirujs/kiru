# i18n — Gap analysis vs Next.js Pages Router

**Status:** P0–P4 **implemented** (tier 3 wave 1). This doc is the original gap analysis plus acceptance criteria and test coverage.

**User guide:** [tier-3-wave-1.md § i18n](../router/tier-3-wave-1.md#i18n)

**Key code:**

| Area | Path |
|------|------|
| Config API | `packages/lib/src/router/i18n/createI18nConfig.ts` |
| URL split / format | `packages/lib/src/router/i18n/routing.ts`, `i18n/localeRouting.ts` |
| Detection / BCP47 | `packages/lib/src/router/i18n/detect.ts` |
| Client router | `packages/lib/src/router/csr.ts` |
| SSR renderer | `packages/lib/src/router/renderer.ts` |
| HTML shell tokens | `packages/lib/src/router/htmlTemplate.ts` (`{{kiru_locale}}`) |
| Context / hydration | `packages/lib/src/router/i18nContext.tsx` |
| Sitemap hreflang | `packages/lib/src/router/site.ts` |
| Static paths | `packages/lib/src/router/manifest.ts` (`generatePublicStaticPaths`) |
| Loaders | `packages/lib/src/router/loaders.ts`, `runPageLoad.ts` |
| E2e | `e2e/ssr`, `e2e/csr`, `e2e/ssg` — `i18n.cy.ts` / `tier3-wave1.cy.ts` |

---

## What Kiru provides (post P0–P4)

Compared to Next.js (routing layer only — Next does **not** ship message catalogs):

| Next.js concept | Kiru |
|-----------------|------|
| Sub-path routing (`/fr/blog`) | Yes — locale stripped before `matchRoute` |
| Single route tree | Yes — logical paths e.g. `/about` |
| Default locale unprefixed (`localePrefix: 'as-needed'`) | Yes — default `createI18nConfig` routing |
| Unsupported locale segment (`/de/about`) | Yes — `invalidLocale: 'redirect' \| 'not-found'` |
| `locale` on navigation | Yes — `Link locale="fr"`, `resolveHref`, `router.setLocale` |
| `Link locale={false}` | Yes — avoids double prefix on already-localized `to` |
| Active locale + catalogs | Yes — `useI18n()` → `{ locale, t, locales, defaultLocale }` |
| Loader `locale` / `locales` / `defaultLocale` | Yes — `LoaderContext` when `i18n` enabled |
| Per-locale static / prerender paths | Yes — `expandPathsForLocales` + `generatePublicStaticPaths` |
| `Accept-Language` + cookie on `/` | Yes — `localeDetection`, `KIRU_LOCALE`, `detectPaths` |
| BCP47 fallback (`nl-BE` → `nl`) | Yes — `resolveLocale` |
| `<html lang>` | Yes — `lang="{{kiru_locale}}"` in `htmlTemplate` (dev warns if misconfigured) |
| `hreflang` in sitemap | Yes — `writeSiteArtifacts({ localeRouting })` from `getI18nLocaleRouting(i18n)`, `loc` aligned with `as-needed` |

**Ahead of Next:** type-safe `useI18n()` via `declare module "kiru/router" { interface Internationalization { config: typeof i18n } }`.

---

## Resolved gaps (reference)

### P0 — URL correctness & SEO

1. **`localePrefix`** — `as-needed` (default) \| `always` \| `never` on `createI18nConfig` / `I18nLocaleRouting`. Applied in `addLocale`, public href helpers, sitemap, prerender expansion.
2. **Invalid locale segment** — `splitAppPathnameDetailed` + `invalidLocale: 'redirect' \| 'not-found'`. Unsupported BCP47-like segments are never treated as logical path segments.

### P1 — Developer ergonomics

3. **`LoaderContext`** — `locale`, `locales`, `defaultLocale` via `loaderI18nFields`.
4. **`useI18n()`** — `locales`, `defaultLocale` (and `router.locale` / `setLocale` on CSR).
5. **`locale={false}`** — `Link` and `resolveHref`.
6. **`router.setLocale`** — preserves logical path, query, hash; updates URL and messages.

### P2 — Build & static output

7. **`expandPathsForLocales`** + **`generatePublicStaticPaths(..., localeRouting)`** for SSG/ISR public paths.
8. **Sitemap** — default-locale `loc` unprefixed when `localePrefix: 'as-needed'`.

### P3 — Detection & persistence

9. **`localeDetection`** + **`detectPaths`** (default `['/']`).
10. **`KIRU_LOCALE`** cookie (name configurable); set on `setLocale`; read before `Accept-Language`.
11. **`resolveLocale`** — exact tag → language subtag → default.

### P4 — SEO polish

12. **`<html lang>`** — template token `{{kiru_locale}}` substituted at render time; `validateRouteHtmlTemplate` warns in dev when `i18n` is enabled but the token or a static `lang="…"` is wrong.

---

## Acceptance checklist

- [x] **P0** Default locale URLs: with `localePrefix: 'as-needed'`, internal links to `/about` not `/en/about`; `/fr/about` still prefixed.
- [x] **P0** `/de/about` with locales `[en, fr]` → redirect (default) or strip + serve logical route (`not-found` policy), not match on `/de/about`.
- [x] **P1** Server loader receives `ctx.locale` matching URL.
- [x] **P1** `setLocale('fr')` on `/about` → `/fr/about` (e2e; query preserved in router API).
- [x] **P1** `<Link to="/fr/about" locale={false}>` does not double-prefix.
- [x] **P2** `generatePublicStaticPaths` includes all locale public paths when `localeRouting` / i18n configured.
- [x] **P3** Visiting `/` with `Accept-Language: fr` redirects to `/fr` when detection enabled.
- [x] **P3** `KIRU_LOCALE=en` overrides Accept-Language on `/` (unit + detection pipeline).
- [x] **P4** SSR HTML includes `<html lang="fr">` for French routes (`{{kiru_locale}}`).
- [x] `e2e/ssr` tier3 i18n + `e2e/csr` / `e2e/ssg` i18n specs.
- [x] `packages/lib/src/tests/unit/i18n.test.ts` + `localeRouting.test.ts`.

---

## Test coverage

| Area | Unit | E2e |
|------|------|-----|
| `localePrefix` / `addLocale` | `localeRouting.test.ts`, `i18n.test.ts` | `/about` unprefixed in SSR/CSR/SSG i18n specs |
| Invalid locale redirect | `i18n.test.ts` | SSR `tier3-wave1` 302; CSR `i18n.cy.ts` |
| Invalid locale `not-found` | `i18n.test.ts` (renderer) | — |
| Loader `ctx.locale` | `i18n.test.ts` | SSR `/fr/loaders/server` |
| `resolveHref` `locale: false` | `i18n.test.ts` | — |
| `setLocale` / `Link locale` | — | SSR, CSR, SSG i18n specs |
| `generatePublicStaticPaths` + i18n | `i18n.test.ts` | SSG prerender `/about`, `/fr/about` |
| Sitemap `loc` + hreflang | `site.test.ts` | — |
| `detectLocale` / cookie / BCP47 | `i18n.test.ts` | — |
| Locale detection redirect `/` → `/fr` | `i18n.test.ts` (renderer) | SSR `tier3-wave1` |
| `{{kiru_locale}}` | `i18n.test.ts` | SSR + SSG `lang=` assertions |

---

## Reference: Next.js feature matrix (current)

| Feature | Next Pages | Kiru |
|---------|------------|------|
| Sub-path routing | Yes | Yes |
| Default locale unprefixed | Yes | Yes (`as-needed`) |
| Domain routing | Yes | Yes (hybrid + `domains[]`) |
| `Accept-Language` on `/` | Yes | Yes |
| `localeDetection: false` | Yes | Yes |
| Preference cookie | `NEXT_LOCALE` | `KIRU_LOCALE` (configurable) |
| Regional fallback `nl-BE`→`nl` | Yes | Yes |
| `router.locale` / `locales` / `defaultLocale` | Yes | Yes |
| `Link` `locale` prop | Yes | Yes |
| `Link` `locale={false}` | Yes | Yes |
| Locale-only navigation | Yes | `setLocale` |
| Loader `locale` | Yes | Yes |
| `getStaticPaths` per locale | Yes | `generatePublicStaticPaths` |
| `<html lang>` | Auto | `{{kiru_locale}}` in template |
| Sitemap hreflang | Manual + sitemap | Built-in with `defineSiteConfig` |
| Built-in messages | No (libraries) | `createI18nConfig` |

---

## Intentional differences (not gaps)

- **No bundled ICU / react-intl** — apps use JSON/modules via `createI18nConfig`.
- **Domain routing** — implemented; see [08-i18n.md](../v2/08-i18n.md#domain-routing-nextjs-style-hybrid).
- **Optional `typesafe-i18n` example** — not in wave 1 ([tier-3-differentiation.md](./tier-3-differentiation.md)).

---

## Related roadmap

[tier-3-differentiation.md](./tier-3-differentiation.md) § Internationalization — all items checked through P4.

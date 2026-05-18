# Tier 3 — Differentiation (optional)

**Goal:** Features that help compete with **Next.js** on specific axes, without committing to RSC or full platform lock-in. **Pick items based on positioning** — not all are required for success.

**Prerequisite:** [Tier 2](./tier-2-framework-parity.md) loader invalidation and at least one deployment adapter.

**Wave 1 guide:** [tier-3-wave-1.md](../router/tier-3-wave-1.md) (implemented APIs and usage).

---

## Caching & revalidation (Next ISR–adjacent)

- [x] **Design: time-based revalidation** — route or site config `revalidate: 60` for hybrid static HTML
- [x] **On-demand revalidation API** — `revalidatePath(path)` / `revalidateTag(tag)` callable from actions or admin route
- [x] **Storage for revalidated HTML** — disk, KV, or in-memory (dev); document production pattern
- [x] **Stale-while-revalidate** — serve stale prerender while regenerating in background
- [x] **E2E + load test** — verify thundering herd behavior (`e2e/ssr/scripts/prerender-regen-single-flight.mjs`)

## Partial prerendering (PPR-lite)

- [x] **Spike: static shell + dynamic holes** — defer blocks via existing streaming + `serverLoader` fallback
- [x] **Route config `dynamic: 'force-static' | 'force-dynamic'`** per segment or page
- [x] **Compare vs full RSC** — document why Kiru stays string/stream component model

## Asset pipeline

- [x] **`<Image>` or documented Vite plugin pattern** — `KiruImage` (srcset, lazy, dimensions)
- [x] **Font preload from `head.links`** — convention + optional build scan
- [ ] **Open Graph image route** — optional `opengraph-image` codegen (low priority)

## Internationalization

- [x] **Locale prefix routing** — `pathPolicy` + `baseUrl` patterns for `/en/...`, `/fr/...`; `Link` `locale` prop
- [x] **`defineSiteConfig` hreflang** — sitemap alternates
- [x] **Doc: loader provides dictionaries** — no built-in i18n lib required
- [x] **`localePrefix` policy + invalid locale URLs** — `as-needed` / `always` / `never`; redirect or 404 for unsupported segments
- [x] **Loader `locale` + `setLocale` / `locale={false}`** — `LoaderContext` i18n fields; `router.setLocale`; `useI18n` metadata
- [x] **Per-locale static generation** — `expandPathsForLocales` + `generatePublicStaticPaths`
- [x] **Locale detection + `KIRU_LOCALE` cookie** — `Accept-Language` on `detectPaths`; BCP47 fallback via `resolveLocale`
- [x] **`<html lang>`** — injected during SSR / stream document assembly
- [ ] **Optional: integrate with `typesafe-i18n` or similar** — example app in sandbox

## Advanced routing

- [ ] **Named parallel outlets** — multiple `RouterView` slots (large effort; evaluate demand)
- [ ] **Intercepting routes / modal URLs** — URL reflects modal, background route unchanged
- [ ] **Route groups** — compile-time only path prefixes without URL segment (generator feature)
- [ ] **REST / API route handlers in tree** — `r.api('/api/users', { POST })` sharing manifest (if not “bring your own server” forever)

## Middleware & edge

- [ ] **Framework middleware chain** — `defineMiddleware` runs before renderer (auth, logging, CORS)
- [ ] **Compose with Hono** — document “middleware in server vs in Kiru” decision tree
- [ ] **Edge streaming limits doc** — chunk sizes, `Transfer-Encoding`, Workers compatibility matrix

## Content & MDX

- [ ] **Content collections spike** — build-time glob + typed frontmatter → static routes
- [ ] **MDX plugin recipe** — Vite + prerender static blog paths
- [ ] **Not required for core router release**

## Developer experience extras

- [ ] **Route manifest dev overlay** — list routes, static vs dynamic, last prerender time (devtools)
- [ ] **Type-safe route paths** — codegen `RoutePath` union from manifest for `Link to={}`
- [ ] **OpenAPI from actions** — experimental; generate from `*.actions.ts` exports

## Ecosystem & enterprise

- [ ] **Auth.js / Better Auth recipe** — session in `CustomRequestContext`
- [ ] **Observability** — OpenTelemetry hooks in `createRenderer` (span per navigation/render)
- [ ] **Rate limiting doc** for `/?action=` and `/?loader=`

## Competitive positioning (deliberate non-goals)

Document these as **intentional** unless strategy changes:

- [x] **RSC / Server Components** — document “client + SSR strings” model ([wave-1 guide](../router/tier-3-wave-1.md#ppr-lite))
- [ ] **Vercel-only features** — no exclusive adapter required
- [ ] **Turbopack** — stay Vite-first

---

## Prioritization matrix

| Item | Effort | Impact | Suggested |
|------|--------|--------|-----------|
| On-demand revalidation (hybrid) | High | High for marketing sites | Yes if hybrid is flagship |
| `<KiruImage>` | Medium | Medium | Yes for “marketing site” segment |
| i18n routing | Medium | High for EU adopters | If target market needs it |
| Parallel routes | Very high | Niche | Defer |
| API routes in tree | Medium | Medium | Only if “full-stack” brand |
| PPR-lite | High | Medium | After streaming maturity |

---

## Success metrics (optional)

- [ ] Time-to-first-hybrid-app from `create-kiru` &lt; 15 minutes (timed doc walkthrough)
- [ ] Router bundle size documented vs Vue Router + minimal SSR handler
- [ ] Third-party template (community) using Tier 1 adapter without fork

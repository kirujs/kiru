# Tier 3 Wave 1 — Hybrid caching, PPR-lite, i18n, assets

User guide for wave-1 router features. API details live in JSDoc on each export; this file is the source for the public docs site.

See also the [tier-3 roadmap](../router-roadmap/tier-3-differentiation.md).

## Overview

Wave 1 adds:

- Loader result caching (`staleTime` / `gcTime`) on the client
- Hybrid ISR (`revalidate`, disk/memory prerender cache, on-demand revalidation)
- PPR-lite via `dynamic` export and existing streaming loaders
- Locale-prefixed routing and hreflang sitemaps
- `KiruImage` and font preload conventions

## Loader caching

Configure per loader:

```ts
export const load = serverLoader({
  staleTime: 30_000,
  gcTime: 300_000,
  load: async () => ({ items: [] }),
  fallback: () => <p>Loading…</p>,
})
```

- **`staleTime`** — milliseconds before data is considered stale (default `0`: refetch on navigation).
- **`gcTime`** — milliseconds to keep unused cache entries (default 5 minutes).

Use `router.invalidate()` to force a refetch immediately (e.g. after a mutation). `router.isLoaderStale` is true when showing cached data past `staleTime`.

**When to use:** client navigations where repeating loader work is expensive. **When not to:** always use `invalidate()` after writes instead of relying on short `staleTime`.

## Hybrid ISR

Page export:

```ts
import { defineISR } from 'kiru/router'

// Hybrid (default): prerender when fresh, SSR fallback, on-demand tags
export const isr = defineISR({
  revalidate: 60, // seconds; false = immutable build output only
  tags: ['blog'],
})

// Prerender-only (404 if HTML missing at request time)
export const isr = defineISR({
  dynamic: 'force-static',
  revalidate: 60,
  tags: ['blog'],
})

// Always SSR — do not combine with revalidate / tags (types + runtime ignore them)
export const isr = defineISR({ dynamic: 'force-dynamic' })
```

At build time, static HTML is written under the Vite client output. In production, `createRenderer({ prerenderedHtmlDir })` serves that HTML when fresh.

**`Cache-Control`:** numeric `revalidate` sets `s-maxage` and `stale-while-revalidate`. See `cachePolicyToHeaders` in the router.

**Dev:** disk prerender is not read in development (`NODE_ENV !== 'production'`).

## On-demand revalidation

Server-only:

```ts
import { revalidatePath, revalidateTag } from 'kiru/router'

await revalidatePath('/docs')
await revalidateTag('blog')
```

Call from actions after mutations. Tags match `isr.tags` on routes.

**Single-flight:** concurrent requests for the same stale path trigger one background regeneration; others receive stale HTML until regen completes.

## PPR-lite

| `dynamic` export | Behavior |
|------------------|----------|
| (default) | Hybrid: serve prerender when allowed, else SSR |
| `force-static` | Prerender only; 404 if missing |
| `force-dynamic` | Always SSR; skip disk prerender |

**Dynamic holes:** `serverLoader({ load, fallback })` with a static `pageHead` streams the fallback shell, then hydrates loader data (existing streaming path).

**Examples in `e2e/ssr`:**

| Route | What it demonstrates |
|-------|----------------------|
| `/ppr/force-dynamic` | `static: true` + `defineISR({ dynamic: 'force-dynamic' })` — HTML exists under `dist/client/ppr/` but requests SSR (loader hit increments per request). |
| `/ppr/force-static` | `defineISR({ dynamic: 'force-static' })` without prerender output — production **404**. |
| `/loaders/server-immediate-shell` | Streaming shell via `serverLoader` + `fallback`. |

Cypress: `e2e/ssr/cypress/e2e/tier3-wave1.cy.ts` (ISR dynamic + streaming). Unit: `packages/lib/src/tests/unit/rendererPprDynamic.test.ts`.

### PPR-lite vs RSC

Kiru intentionally does not implement React Server Components. Pages are functions returning HTML strings or JSX rendered on the server and client. Streaming uses loader fallbacks and deferred `resource()` — not component-level server boundaries.

## i18n

Define locales once, load JSON (or any module) per locale, and use type-safe `useI18n()` in pages and layouts. The router matches **logical** paths (e.g. `/about`); the browser URL adds the locale prefix (`/en/about`, `/fr/about`) without duplicating route definitions.

### Config

```ts
// src/i18n.ts
import { createI18nConfig } from "kiru/router"

const i18n = createI18nConfig(["en", "fr"])({
  default: "en",
  load: {
    en: () => import("./i18n/en.json"),
    fr: () => import("./i18n/fr.json"),
  },
})

declare module "kiru/router" {
  interface Internationalization {
    config: typeof i18n
  }
}

export default i18n
```

Wire the same config on server and client:

```ts
createRenderer({ routes, i18n, /* ... */ })
createRouterApp({ routes, i18n, container })
```

Optional: `defineSiteConfig({ locales: { default: "en", prefixes: ["en", "fr"] } })` for hreflang in `sitemap.xml` (can mirror `i18n.locales`).

### Pages

```tsx
import { useI18n } from "kiru/router"

export default function About() {
  const { locale, t } = useI18n()
  return <h1>{t.title}</h1> // `t` is typed from your JSON
}
```

Define a single route: `r.page("/about", { component: () => import("./pages/about") })`.

### Links and URLs

- `Link` accepts `locale="fr"` to target another prefix.
- `router.resolveHref("/about", { locale: "fr" })` → `/fr/about`.
- `locale={false}` on `Link` / `resolveHref` when `to` already includes a locale prefix.
- `router.setLocale("fr")` keeps the current logical path and query.
- Default locale uses no prefix when `localePrefix` is `as-needed` (default): `/about` not `/en/about`.

### Document language

In your SSR/SSG `index.html` shell:

```html
<html lang="{{kiru_locale}}">
```

`createRenderer({ i18n })` substitutes the active locale at render time. In development, Kiru warns if `i18n` is enabled but the template is missing `{{kiru_locale}}` or still uses a static `lang="en"`.

Low-level helpers (`stripLocale`, `addLocale`, `splitAppPathname`) remain on `pathPolicy` / `kiru/router` for sitemaps and custom tooling.

## Assets

### KiruImage

```tsx
<KiruImage src="/hero.jpg" alt="Hero" width={800} height={400} />
```

Sets `width`/`height` for CLS, `loading="lazy"` by default, and a simple `1x`/`2x` `srcset`.

### Font preload

In `export const head`:

```ts
links: [
  {
    rel: 'preload',
    as: 'font',
    href: '/fonts/inter.woff2',
    type: 'font/woff2',
    crossOrigin: 'anonymous',
  },
]
```

## Operations

- **Storage:** wave 1 supports in-memory (tests/dev) and disk sidecar metadata next to prerendered HTML. Multi-instance production needs a shared store (KV/R2) — not included in wave 1.
- **Tier 2 adapters:** not required for wave 1; use Node + disk hybrid.

## Migration

1. Add `export const revalidate` on static marketing pages.
2. Wire `revalidatePath` in post-mutation actions.
3. Set `staleTime` on list loaders; call `invalidate()` after creates/updates.
4. Add `createI18nConfig` + `useI18n()`; pass `i18n` to `createRenderer` / `createRouterApp`.
5. Replace raw `<img>` with `KiruImage` on landing pages.

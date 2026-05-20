# Head metadata, site config, and images

## Route `head`

Declarative per scope/page (`types.ts` `RouteHeadMeta`):

```ts
r.page("/seo", {
  component: () => import("./pages/seo.tsx"),
  head: {
    title: "E2E SSG SEO",
    description: "JSON-LD and static path demos.",
    keywords: ["kiru", "ssg", "e2e"],
    robots: "index,follow",
    canonical: "https://example.com/seo",
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: "E2E SSG SEO",
    },
  },
})
```

### Merge rules

- Walk scope chain root → leaf
- Child overrides parent fields (shallow merge)
- **Sync** dynamic titles (params only, no loader) → `defineHeadContent((ctx) => ({ title: \`User ${ctx.params.id}\` }))` — does not block SSR shell streaming with `serverLoader`
- **Async** dynamic titles (needs loader data) → `defineHeadContent(async (ctx) => { const { data } = await ctx.loader(); return { title: … } })` — awaits before non-streaming SSR; blocks early head flush when combined with streaming loads

### SSR/SSG output

Serialized into `DocumentHead` during render → `<title>`, `<meta name="description">`, `<meta name="keywords">`, `<meta name="robots">`, `<link rel="canonical">`, `<script type="application/ld+json">`.

### CSR and post-hydration navigations

`syncDocumentHeadForPage` updates **`document.title` only** after route commits (`documentHeadClient.ts`). Description, Open Graph, canonical, JSON-LD, and link tags come from the **first HTML** (SSR/SSG prerender or `index.html` shell) and are not reconciled on client navigations — crawlers and link unfurlers use that initial response, not in-app routing.

Dynamic `defineHeadContent((ctx, props) => …)` still runs after loaders; only the resolved **`title`** is applied on the client.

## `defineSiteConfig`

```ts
import { defineSiteConfig } from "kiru/router"

export const site = defineSiteConfig({
  url: "https://e2e-ssr.example",
  pathPolicy: { trailingSlash: "never" },
  locales: ["en", "fr"],
  sitemap: {
    include: ["/users/[id]"],
    exclude: ["/guarded", "/loaders/server"],
  },
  robots: true,
})
```

### Sitemap path sources

`generateSitemapPaths` (`manifest.ts`):

1. All `generateStaticPaths` URLs
2. If SSR hybrid (`defaultSsrPaths`): non-static param-less routes (e.g. `/`, `/about`)
3. `sitemap.include` dynamic templates → `generateSitemapParams` on page modules
4. Minus `sitemap.exclude` templates

**Example** (`e2e/ssr/src/site.config.ts`):

```ts
sitemap: {
  include: ["/users/[id]"],
  exclude: ["/guarded", "/loaders/server", ...],
},
```

### `robots.txt`

Emitted at build when `robots: true`.

## Images (`kiru/image` + `Image`)

See [docs/router/kiru-image.md](../router/kiru-image.md).

### Build-time strategy

```ts
// vite.config.ts
kiru({
  router: {
    images: {
      optimize: true,
      formats: ["webp"],
      config: { strategy: "build" },
    },
  },
})
```

```tsx
import hero from "./assets/hero.jpg"
import { Image } from "kiru"

<Image src={hero} alt="Hero" width={800} />
```

### Runtime strategy (Node/Bun SSR)

```ts
createKiruResponder({
  image: { config: { strategy: "runtime" }, sharp },
})
```

Cloudflare: build strategy only.

### E2E

- `e2e/csr/cypress/e2e/image.cy.ts`
- `e2e/ssg/cypress/e2e/image.cy.ts`
- SSR image pages when build strategy enabled

## Font preload conventions

Tier 3 doc: link rel preload for fonts in route `head` or layout — follow `tier-3-wave-1.md` font section for copy-paste.

## Use-case: marketing SEO page

```ts
r.page("/pricing", {
  static: true,
  component: () => import("./pricing.tsx"),
  head: {
    title: "Pricing",
    description: "Plans and features",
    jsonLd: { "@type": "Product", name: "Pricing" },
  },
})
```

## Use-case: noindex admin

```ts
r.scope({
  meta: { requiresAuth: true },
  head: { robots: "noindex,nofollow" },
  children: [...],
})
```

## Use-case: sitemap with dynamic users

```ts
// site.config.ts
sitemap: { include: ["/users/[id]"] }

// pages/users/[id].tsx
export async function generateSitemapParams() {
  return users.map((u) => ({ id: String(u.id) }))
}
```

## Use-case: OG image (manual)

```ts
head: {
  openGraph: {
    title: "Share title",
    image: "https://cdn.example/og.png",
  },
}
```

(Use exact field names from `RouteHeadMeta` in `types.ts` when documenting publicly.)

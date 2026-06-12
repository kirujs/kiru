# Head, SEO & sitemap

## Overview

Document metadata (title, description, Open Graph, Twitter cards, JSON-LD, link tags) is declared at three levels:

1. **Route tree** — `head` on scopes and leaves
2. **Page module** — `export const head = defineHeadContent(…)`
3. **Site config** — `defineSiteConfig()` for sitemap and robots at build

The server merges head layers along the matched scope chain and serializes HTML into `{{kiru_head}}` in the document shell.

---

## How it works

### Head layering

`head` on a scope or route:

- **Object** — replaces inherited head entirely.
- **Function** — `(inherited) => mergedHead` extends ancestor head via `mergeRouteHead`.

Resolution order: root scope → nested scopes → leaf route → page `head` export (page wins last).

### Static vs dynamic head

```ts
// Static object on route tree
head: { title: "About", description: "Our story" }

// Dynamic from loader context
export const head = defineHeadContent((ctx) => ({
  title: `User ${ctx.params.id}`,
  openGraph: { title: ctx.data?.name },
}))
```

`defineHeadContent` accepts a static `RouteHeadMeta` object or a function receiving loader context.

### RouteHeadMeta fields

```ts
type RouteHeadMeta = {
  title?: string
  titleTemplate?: string      // "%s | My App"
  description?: string
  canonical?: string
  robots?: string
  openGraph?: {
    title?: string
    description?: string
    type?: string
    url?: string
    image?: string | string[]
    siteName?: string
  }
  twitter?: {
    card?: "summary" | "summary_large_image" | …
    title?: string
    description?: string
    image?: string
  }
  jsonLd?: Record<string, unknown> | Record<string, unknown>[]
  links?: Array<{ rel: string; href: string; [key: string]: string }>
  extraMeta?: Array<{ name?: string; property?: string; content: string }>
}
```

### Sitemap generation

At SSG build, `defineSiteConfig()` provides:

- `url` — site origin
- `sitemap` — changefreq, priority, per-path overrides, include/exclude templates
- `robots` — robots.txt rules

`generateSitemapPaths(manifest, siteConfig)` discovers URLs from static routes. Dynamic templates listed in `sitemap.include` expand via `generateSitemapParams` exported from page modules.

`writeSiteArtifacts(outDir, paths, siteConfig)` writes `sitemap.xml` and `robots.txt`.

### Per-route sitemap params

```ts
export async function generateSitemapParams() {
  const users = await listAllUsers()
  return users.map((u) => ({ params: { id: u.id } }))
}
```

Export from the page module for dynamic segments like `/users/[id]`.

---

## API reference

```ts
import {
  defineHeadContent,
  type KiruPageHead,
  type StaticPageHead,
  type DynamicPageHead,
  type RouteHeadMeta,
  mergeRouteHead,
  serializeDocumentHead,
} from "kiru/router"

import {
  defineSiteConfig,
  writeSiteArtifacts,
  buildSitemapXml,
  generateSitemapPaths,
  type SiteConfig,
  type SitemapOptions,
} from "kiru/router"
```

### Page module co-exports (not package imports)

`generateStaticParams` and `generateSitemapParams` are **named exports from page modules**, not imports from `kiru/router`:

```ts
type GenerateStaticParamsContext = {
  params: Record<string, string>
}

type GenerateStaticParams = (
  ctx: GenerateStaticParamsContext
) => Promise<Array<Record<string, string>>> | Array<Record<string, string>>

type GenerateSitemapParams = GenerateStaticParams
```

Route-tree `head` fields use `RouteHeadMeta` (defined above). See [routes-and-scopes.md](./routes-and-scopes.md) for `RouteHeadMetaInput` on scopes and leaves.

---

## Examples

### Basic — static title on route

```ts
createRoute("/about", {
  component: () => import("./pages/about"),
  head: {
    title: "About us",
    description: "Learn about our company",
  },
})
```

### Intermediate — page dynamic head

```tsx
import { serverLoader, defineHeadContent, type PageProps } from "kiru/router"

export const load = serverLoader({
  load: async ({ params }) => fetchArticle(params.slug),
  fallback: () => <ArticleSkeleton />,
})

export const head = defineHeadContent(({ data, params }) => ({
  title: data?.title ?? params.slug,
  description: data?.excerpt,
  openGraph: {
    type: "article",
    title: data?.title,
    image: data?.coverImage,
  },
  twitter: { card: "summary_large_image" },
}))
```

### Intermediate — scope title template

```ts
createRouteScope({
  layout: () => import("./layouts/blog"),
  head: (inherited) => ({
    ...inherited,
    titleTemplate: "%s | My Blog",
    openGraph: { siteName: "My Blog" },
  }),
  children: [
    createRoute("/blog/[slug]", () => import("./pages/post")),
  ],
})
```

### Advanced — site config and sitemap

```ts
// site.config.ts
import { defineSiteConfig } from "kiru/router"

export const site = defineSiteConfig({
  url: "https://example.com",
  sitemap: {
    changefreq: "weekly",
    priority: 0.7,
    include: ["/blog/[slug]", "/users/[id]"],
    exclude: ["/admin/*"],
    overrides: {
      "/": { priority: 1.0, changefreq: "daily" },
    },
  },
  robots: {
    rules: [{ userAgent: "*", allow: "/" }],
    sitemap: "https://example.com/sitemap.xml",
  },
})
```

```ts
// vite.config.ts
kiru({ router: { ssg: { routes: "./src/routes.ts", siteModule: "./src/site.config.ts" } } })
```

### Advanced — dynamic sitemap entries

```tsx
// pages/users/[id]/page.tsx
export async function generateSitemapParams() {
  const users = await db.users.findMany({ select: { id: true } })
  return users.map((u) => ({ params: { id: u.id } }))
}
```

### FBR — head in page.config.ts

```ts
// pages/pricing/page.config.ts
import type { RoutePageConfig } from "kiru/router"

export default {
  static: true,
  head: {
    title: "Pricing",
    description: "Plans for every team size",
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "Product",
      name: "Pro Plan",
    },
  },
} satisfies RoutePageConfig
```

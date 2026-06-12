# ISR & revalidation

## Overview

Incremental Static Regeneration (ISR) lets hybrid apps serve prerendered HTML from disk with a TTL, falling back to SSR when stale or missing. Export `isr` from page modules via `defineISR`, and trigger on-demand invalidation with `revalidatePath` or `revalidateTag`.

ISR requires a Node or Bun deploy target with disk prerender cache support.

---

## How it works

### ISR config on pages

```ts
export const isr = defineISR({
  revalidate: 60,           // seconds; false = immutable after first prerender
  tags: ["blog", "posts"],
})
```

| `dynamic` | Behavior |
|-----------|----------|
| omitted (hybrid) | Serve fresh prerender from disk; SSR when stale/missing |
| `"force-static"` | Never SSR after first prerender |
| `"force-dynamic"` | Always SSR; no disk cache read/write |

### Prerender cache

`diskPrerenderCache` stores rendered HTML keyed by path. On request:

1. Match route and read `isr` export.
2. If hybrid and cache entry is fresh → return cached HTML.
3. If stale or missing → SSR, optionally write new cache entry.
4. `force-dynamic` skips cache entirely.

### On-demand revalidation

From server code (mutations, API routes, webhooks):

```ts
import { revalidatePath, revalidateTag } from "kiru/router"

await revalidatePath("/blog/my-post")
await revalidateTag("blog")
```

- `revalidatePath` — invalidates one pathname's cache entry.
- `revalidateTag` — invalidates all routes tagged with that string.

On the client bundle, these are stubs that no-op or proxy to the server in hybrid setups.

### Build-time metadata

`discoverRouteBuildMeta` scans routes for ISR exports and tags at build time for cache warming and deploy manifests.

### Hybrid Vite build

```ts
kiru({
  router: {
    ssg: true,
    serverEntry: "./src/server.ts",
    adapter: "node",
  },
})
```

Build prerenders `static: true` routes; ISR routes get initial HTML plus server regeneration.

---

## API reference

```ts
import {
  defineISR,
  isKiruISRConfig,
  type ISRConfig,
  type KiruISRConfig,
  type RouteRevalidate,
  revalidatePath,
  revalidateTag,
  discoverRouteBuildMeta,
  diskPrerenderCache,
} from "kiru/router"
```

```ts
type HybridISRConfig = {
  dynamic?: "force-static"
  revalidate?: number | false
  tags?: string[]
}

type ForceDynamicISRConfig = {
  dynamic: "force-dynamic"
}

function defineISR(config: ISRConfig): KiruISRConfig
```

---

## Examples

### Basic — 60-second TTL

```tsx
import { defineISR, staticLoader, type PageProps } from "kiru/router"

export const isr = defineISR({ revalidate: 60 })

export const load = staticLoader(async () => ({
  headline: await fetchHeadline(),
}))

export default function HomePage({ data }: PageProps<typeof load>) {
  return () => <h1>{data.headline}</h1>
}
```

### Intermediate — tagged blog posts

```tsx
export const isr = defineISR({
  revalidate: 300,
  tags: ["blog"],
})

export const load = serverLoader({
  load: async ({ params }) => fetchPost(params.slug),
  fallback: () => <PostSkeleton />,
})
```

### Intermediate — mutation triggers revalidation

```ts
import { mutation } from "kiru/remote"
import { revalidateTag } from "kiru/router"

export const publishPost = mutation(async () => {
  const { context } = getRequestEvent()
  const post = await createPost(context.user!.id)
  await revalidateTag("blog")
  await revalidatePath(`/blog/${post.slug}`)
  return post
})
```

### Advanced — force static marketing, dynamic app

```tsx
// pages/pricing/page.tsx — immutable after build
export const isr = defineISR({ revalidate: false })
```

```tsx
// pages/app/dashboard/page.tsx — always fresh SSR
export const isr = defineISR({ dynamic: "force-dynamic" })
```

### Advanced — standalone prerender with ISR metadata

```ts
import { prerenderStaticRoutes, diskPrerenderCache } from "kiru/router"

const outputs = await prerenderStaticRoutes({
  routes,
  outDir: "./dist/client",
  site,
})

// diskPrerenderCache integrates with createKiruHandler in production
```

```ts
createKiruHandler({
  routes,
  importMetaUrl: import.meta.url,
  prerenderedHtmlDir: "./dist/client",
})
```

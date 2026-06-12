# Loaders & page data

## Overview

Page loaders fetch data before a route renders. Export `load` from a page module (or pass via route config in advanced setups). The page default export receives `PageProps<typeof load>` with either `data` or `error`.

Four loader kinds cover different execution environments:

| Kind | Factory | First paint | SSG build | Client navigation |
|------|---------|-------------|-----------|-------------------|
| Server | `serverLoader` | Server runs load; fallback UI while pending | Skipped (not static) | RPC to server when SSR bundle exists |
| Static | `staticLoader` | Inlined in HTML | Runs at prerender | Reads inlined payload |
| Universal | `loader` | Server runs load | Optional | Re-runs on client |
| Client | `clientLoader` | Skipped | Skipped | Client only |

---

## How it works

### Loader context

Every loader receives `LoaderContext`:

```ts
type LoaderContext = {
  params: Record<string, string>       // or validated via validation config
  url: { pathname, search, hash }
  query: RouterQuery                     // raw or validated
  context: CustomRequestContext
  meta: RouteMeta
  route: { id: string }
  request?: Request
  signal: AbortSignal
  locale?: string
  locales?: readonly string[]
  defaultLocale?: string
}
```

`signal` aborts when a newer navigation starts or the request is cancelled.

### Page props

```ts
type PageProps<TLoader> =
  | { data: LoaderData<TLoader>; error: null }
  | { data: null; error: Error }
```

Loaders complete before the page mounts — there is no in-page loading state unless you use `serverLoader` fallback UI during SSR streaming.

### Server loader fallback

`serverLoader` requires `fallback: () => JSX` in config form. During streaming SSR, the shell renders fallback immediately; loader data streams in the HTML tail and hydrates on the client.

```ts
serverLoader({
  load: async (ctx) => fetchPosts(ctx.params.id),
  fallback: () => <PostSkeleton />,
})
```

### Validation

Pass `validation` with Standard Schema validators for `params` and/or `query`:

```ts
loader({
  validation: {
    params: idSchema,
    query: sortSchema,
  },
  load: async ({ params, query }) => { /* typed */ },
})
```

Invalid params/query produce loader errors surfaced via `PageProps.error`.

### Caching (client navigation)

| Option | Default | Meaning |
|--------|---------|---------|
| `staleTime` | `0` | Ms before data is stale; `0` = refetch every nav |
| `gcTime` | `300_000` | Ms to retain unused cache entries |

Call `router.invalidate({ routeIds?: string[] })` to bust cache after mutations.

### Page data hydration

SSR/SSG embed loader JSON in `<script k-page-data>`. On first paint the client reads this payload instead of re-fetching. CSR navigations clear hydrated page data and fetch fresh.

`readHydratedPageData()` reads the script once; `resetHydratedPageData()` clears it on client nav.

### Remote queries in loaders

On the server, call `query()` functions in-process inside loaders:

```ts
export const load = serverLoader(async () => {
  const posts = await getPosts({ sort: "hot" })
  return { posts }
})
```

`serverLoader({ load: voidQuery })` accepts void-input queries directly. Parameterized queries use `load: (ctx) => getPosts({ sort: ctx.query.sort })`.

### Loader RPC

When an SSR server bundle is present, `serverLoader` re-invokes on client navigation via `POST /?loader=`. `ensureLoaderClient()` wires the client; `createLoaderHandler()` builds the server handler. Custom servers import `kiru/router/loaderClient` and `kiru/router/loaderRegistry`.

### Dynamic head from loaders

`defineHeadContent` accepts a function receiving loader context:

```ts
export const head = defineHeadContent((ctx) => ({
  title: `Post: ${ctx.params.id}`,
}))
```

### Static loader prerender capture

`staticLoader` data is captured at SSG build and inlined per route. Use `generateStaticParams` on the page module to enumerate dynamic static paths.

---

## API reference

### Loader factories

```ts
import {
  serverLoader,
  staticLoader,
  loader,
  clientLoader,
  type LoaderContext,
  type LoaderFn,
  type PageProps,
  type LoaderData,
  type KiruLoader,
  isKiruLoader,
} from "kiru/router"
```

```ts
// serverLoader — fallback required in config form
serverLoader(fn)
serverLoader({ load, fallback, staleTime?, gcTime? })
serverLoader({ validation, load, fallback, staleTime?, gcTime? })

staticLoader(fn)
loader(fn | { load, staleTime?, gcTime? } | { validation, load, ... })
clientLoader(fn | { load, validation?, staleTime?, gcTime? })
```

### Loader context and props

```ts
type LoaderContext = {
  params: Record<string, string>
  url: { pathname: string; search: string; hash: string }
  query: RouterQuery
  context: CustomRequestContext
  meta: RouteMeta
  route: { id: string }
  request?: Request
  signal: AbortSignal
  locale?: string
  locales?: readonly string[]
  defaultLocale?: string
}

type RouterQuery = Record<string, string[]>

type LoaderFn<T, Ctx extends LoaderContext = LoaderContext> = (
  ctx: Ctx
) => Promise<T> | T

type LoaderData<T> = /* inferred return type of KiruLoader or LoaderFn */

type PageProps<TLoader> =
  | { data: LoaderData<TLoader>; error: null }
  | { data: null; error: Error }

type LoaderValidationConfig = {
  query?: Schema<unknown>
  params?: Schema<unknown>
  onInvalid?: ValidationInvalidHandler
  redirectToCanonical?: boolean
  queryDefaults?: Record<string, unknown>
}
```

`RouteMeta` is augmentable — see [routes-and-scopes.md](./routes-and-scopes.md). `CustomRequestContext` is defined in [request-context.md](./request-context.md).

### Head

```ts
import { defineHeadContent, type KiruPageHead } from "kiru/router"
```

### Page data (advanced)

```ts
import {
  readHydratedPageData,
  resetHydratedPageData,
  serializePageDataScript,
} from "kiru/router"
```

### Loader RPC (custom servers)

```ts
import { ensureLoaderClient } from "kiru/router/loaderClient"
import { createLoaderHandler } from "kiru/router/loaderRegistry"
```

### Search validation helper

```ts
import { createQueryValidation } from "kiru/router"
```

---

## Examples

### Basic — server loader with fallback

```tsx
import { serverLoader, type PageProps } from "kiru/router"

export const load = serverLoader({
  load: async ({ params }) => {
    const res = await fetch(`https://api.example.com/users/${params.id}`)
    return res.json()
  },
  fallback: () => <p class="skeleton">Loading user…</p>,
})

export default function UserPage({ data, error }: PageProps<typeof load>) {
  if (error) return <p>Failed: {error.message}</p>
  return () => (
    <main>
      <h1>{data.name}</h1>
      <p>{data.email}</p>
    </main>
  )
}
```

### Intermediate — static loader for SSG blog

```tsx
import { staticLoader, type PageProps } from "kiru/router"

export const load = staticLoader(async () => {
  const posts = await readPostsFromDisk()
  return { posts }
})

export default function BlogIndex({ data }: PageProps<typeof load>) {
  return () => (
    <ul>
      {data.posts.map((p) => <li key={p.slug}>{p.title}</li>)}
    </ul>
  )
}
```

Mark the route `static: true` in the tree or `page.config.ts`.

### Intermediate — universal loader

```tsx
import { loader, type PageProps } from "kiru/router"

export const load = loader(async ({ url }) => ({
  visitedAt: Date.now(),
  path: url.pathname,
}))

export default function UniversalPage({ data }: PageProps<typeof load>) {
  return () => <p>Loaded at {data.visitedAt} for {data.path}</p>
}
```

Runs on server first paint and re-runs on every client navigation.

### Intermediate — client-only loader

```tsx
import { clientLoader, type PageProps } from "kiru/router"

export const load = clientLoader(async () => {
  const geo = await navigator.geolocation.getCurrentPosition(/* … */)
  return { lat: geo.coords.latitude, lng: geo.coords.longitude }
})
```

Skipped on SSR — page renders without data until client load completes on CSR/after hydrate.

### Advanced — loader calling remote query

```ts
// feed.remote.ts
import { query } from "kiru/remote"
export const getFeed = query(sortSchema, async ({ sort }) => fetchFeed(sort))
```

```tsx
// feed/page.tsx
import { serverLoader, type PageProps } from "kiru/router"
import { getFeed } from "./feed.remote"

export const load = serverLoader({
  load: async () => {
    const [hot, new_] = await Promise.all([
      getFeed({ sort: "hot" }),
      getFeed({ sort: "new" }),
    ])
    return { hot, new: new_ }
  },
  fallback: () => <FeedSkeleton />,
})
```

Server calls queries in-process; browser navigations use loader RPC then queries via HTTP as needed.

### Advanced — validated params and query

```tsx
import { loader } from "kiru/router"
import { z } from "zod" // or any Standard Schema

const paramsSchema = z.object({ id: z.string().min(1) })
const querySchema = z.object({ tab: z.enum(["posts", "comments"]).default("posts") })

export const load = loader({
  validation: { params: paramsSchema, query: querySchema },
  load: async ({ params, query }) => {
    return fetchProfile(params.id, query.tab)
  },
})
```

### Advanced — dynamic head from loader context

```tsx
import { serverLoader, defineHeadContent, type PageProps } from "kiru/router"

export const load = serverLoader({
  load: async ({ params }) => fetchArticle(params.slug),
  fallback: () => <ArticleSkeleton />,
})

export const head = defineHeadContent(({ params }) => ({
  title: `Article: ${params.slug}`,
  openGraph: { type: "article" },
}))

export default function ArticlePage({ data }: PageProps<typeof load>) {
  return () => (
    <article>
      <h1>{data.title}</h1>
      <div>{data.body}</div>
    </article>
  )
}
```

### Advanced — invalidate after mutation

```tsx
import { useRouter } from "kiru/router"
import { updatePost } from "./posts.remote"

export default function EditPost() {
  const router = useRouter()
  return () => (
    <button
      type="button"
      onclick={async () => {
        await updatePost({ id: "1", title: "Updated" })
        await router.invalidate({ routeIds: ["posts/[id]"] })
      }}
    >
      Save
    </button>
  )
}
```

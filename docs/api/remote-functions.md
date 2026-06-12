# Remote functions

## Overview

Remote functions are server-side handlers invoked from the client over HTTP or called in-process during SSR and loaders. Two primitives exist:

| Primitive | Purpose | Callable during render? | HTTP |
|-----------|---------|------------------------|------|
| `query()` | Server read, cached by input | Yes — `resource()`, loaders | `POST /?query=<id>` |
| `mutation()` | Server write (JSON body) | No — events/handlers only | `POST /?mutation=<id>` |

Define remotes in `*.remote.ts` files. The Vite plugin transforms them into client stubs and registers server handlers via a generated registry virtual module.

Route **loaders** remain the URL/page data layer; they call `query()` in-process on the server instead of duplicating fetch logic.

---

## How it works

### Authoring modules

Place remotes in files matching the Vite `router.remote` glob (default `**/*.remote.ts`). Import from `kiru/remote`:

```ts
import { query, mutation, getRequestEvent, redirect, RemoteError } from "kiru/remote"
```

In UI modules, import the exported handles from `.remote.ts` files. Browser bundles use codegen stubs — handlers do not run in the client bundle.

### Validation

Pass a Standard Schema as the first argument when input is validated:

```ts
query(schema, handler)
mutation(schema, handler)
```

Without a schema, handlers take no input argument (void input).

### Handler signatures

| Kind | No schema | With schema |
|------|-----------|-------------|
| `query` | `() => Output` | `(input: Input) => Output` |
| `mutation` | `() => Output` | `(input: Input) => Output` |

Framework concerns (`context`, `cookies`, `request`, `signal`, `redirect`) come from **`getRequestEvent()`** inside the handler — not from handler arguments.

```ts
export const getUser = query(async () => {
  const { cookies, context } = getRequestEvent()
  return findUser(cookies.get("session_id"), context)
})
```

### Queries in components

Use `resource()` from `kiru` — not a separate query hook:

```tsx
import { resource } from "kiru"
import { getFeed } from "./feed.remote"

const feed = resource({
  source: { sort },
  load: getFeed,
  defaultState: [],
})
```

`getFeed({ sort: "hot" })` returns a promise. `getFeed.key({ sort: "hot" })` returns a `RemoteQueryInstance` with `.refresh()`, `.set()`, `.optimistic()`.

### Query cache

- Client deduplicates by query id + serialized input.
- `buildQueryCacheKey(query, input)` builds the cache key.
- `seedQueryCache` pre-populates from SSR injection.
- `applyQueryPatches` applies server-sent invalidations after mutations.
- `clearAllQueryCache()` resets client cache (testing).

### Mutations

Call from event handlers — never during SSR render (throws in dev):

```tsx
onclick={async () => {
  await votePost({ id: postId, direction: "up" })
}}
```

Optional trailing `{ signal }` aborts in-flight requests:

```ts
await updatePost(input, { signal: controller.signal })
```

### Refreshing queries after mutations

Inside a mutation handler on the server:

```ts
import { requested } from "kiru/remote"

export const votePost = mutation(voteSchema, async (input) => {
  await recordVote(input)
  await requested(getFeed, 8).refreshAll()
  return { ok: true }
})
```

`requested(query, limit)` iterates client-requested query instances and refreshes them. The wire response can include `__kiruQueryPatches` for client cache updates.

### Server wiring

```ts
import { createRemoteHandler } from "kiru/remote"
import "virtual:kiru:remote-registry"

const handleRemotes = createRemoteHandler(secret, {
  allowedOrigins: ["https://myapp.com"],
})
```

Mount on your HTTP server alongside the page renderer. SSR bootstrap automatically ensures client dispatch for mutations and queries.

### In-process vs HTTP

| Environment | Behavior |
|-------------|------|
| SSR render / server loader | Direct in-process call |
| Browser | HTTP POST to server |
| `runWithSsrRequestContext` | Scoped in-process calls during SSR |

### Errors

Throw `RemoteError` for typed client errors. `isRemoteError(err)` type-guards on the client.

`redirect(status, location)` inside a mutation returns a redirect response via `getRequestEvent().redirect`.

---

## API reference

### Authoring

```ts
import {
  query,
  mutation,
  getRequestEvent,
  requested,
  redirect,
  isKiruRedirect,
  RemoteError,
  isRemoteError,
  createRemoteHandler,
  runWithSsrRequestContext,
  type RemoteQuery,
  type RemoteQueryInstance,
  type RemoteMutation,
  type MutationResult,
  type RemoteCallOptions,
  isRemoteQuery,
} from "kiru/remote"
```

### Query instances

```ts
const instance = getPosts.key({ sort: "hot" })
await instance.refresh()
instance.set(newData)
instance.optimistic(() => patchedData)
```

### Cache helpers

```ts
import {
  buildQueryCacheKey,
  seedQueryCache,
  applyQueryPatches,
  clearAllQueryCache,
  type KiruQueryPatch,
  KIRU_QUERY_PATCHES_KEY,
} from "kiru/remote"
```

### Abort and call options

```ts
import {
  remoteCallContext,
  peelRemoteCallArgs,
  type RemoteCallOptions,
} from "kiru/remote"
```

`remoteCallContext` provides an implicit abort bag for loaders and `resource()`. Pass `{ signal }` as the last argument to query/mutation calls to override.

### Consuming in UI

```ts
import { resource } from "kiru"
```

---

## Examples

### Basic — query + resource

```ts
// posts.remote.ts
import { query } from "kiru/remote"

export const getPosts = query(async () => [
  { id: "1", title: "Hello" },
  { id: "2", title: "World" },
])
```

```tsx
// posts/page.tsx
import { resource } from "kiru"
import { getPosts } from "./posts.remote"

export default function PostsPage() {
  const posts = resource({ load: getPosts, defaultState: [] })
  return () => (
    <ul>
      {posts.value.map((p) => <li key={p.id}>{p.title}</li>)}
    </ul>
  )
}
```

### Intermediate — validated query

```ts
import { z } from "zod"
import { query } from "kiru/remote"

const sortSchema = z.object({
  sort: z.enum(["hot", "new", "top"]),
  communitySlug: z.string().optional(),
})

export const getFeed = query(sortSchema, async ({ sort, communitySlug }) => {
  return fetchFeed({ sort, communitySlug })
})
```

```tsx
const sort = signal<"hot" | "new">("hot")
const communitySlug = signal<string | undefined>(undefined)
const feed = resource({
  source: { sort, communitySlug },
  load: getFeed,
  defaultState: [],
})
```

### Intermediate — mutation from button

```ts
// todos.remote.ts
import { mutation } from "kiru/remote"

export const addTodo = mutation(async () => {
  const { context } = getRequestEvent()
  return createTodo(context.user.id)
})
```

```tsx
import { addTodo } from "./todos.remote"

<button type="button" onclick={async () => { await addTodo() }}>
  Add todo
</button>
```

### Advanced — namespaced API module

```ts
// api.remote.ts
import { query, mutation } from "kiru/remote"

export const api = {
  getEcho: query(async () => "hello"),
  removeLabel: mutation(async () => ({ removed: true })),
}

export const runPipeline = mutation(async () => {
  const echo = await api.getEcho()
  await api.removeLabel()
  return { echo, done: true }
})
```

### Advanced — mutation refreshes feed queries

```ts
import { mutation, requested } from "kiru/remote"
import { getFeed } from "./feed.remote"

const voteSchema = z.object({ postId: z.string(), direction: z.enum(["up", "down"]) })

export const votePost = mutation(voteSchema, async (input) => {
  await recordVote(input)
  await requested(getFeed, 8).refreshAll()
  return { voted: true }
})
```

### Advanced — loader composes queries

```tsx
import { serverLoader, type PageProps } from "kiru/router"
import { getPosts, getStats } from "./dashboard.remote"

export const load = serverLoader({
  load: async () => {
    const [posts, stats] = await Promise.all([getPosts(), getStats()])
    return { posts, stats }
  },
  fallback: () => <DashboardSkeleton />,
})

export default function Dashboard({ data }: PageProps<typeof load>) {
  return () => (
    <div>
      <p>{data.stats.total} posts</p>
      <PostList posts={data.posts} />
    </div>
  )
}
```

### Advanced — server handler setup

```ts
// server.ts
import { createKiruHandler } from "@kirujs/adapter-node"
import { createRemoteHandler } from "kiru/remote"
import "virtual:kiru:remote-registry"

const handlePage = createKiruHandler({ routes, getRequestContext })
const handleRemote = createRemoteHandler(process.env.REMOTE_SECRET!, {
  allowedOrigins: [process.env.APP_ORIGIN!],
})

export default {
  async fetch(request: Request) {
    const url = new URL(request.url)
    if (url.searchParams.has("query") || url.searchParams.has("mutation")) {
      return handleRemote(request)
    }
    return handlePage(request)
  },
}
```

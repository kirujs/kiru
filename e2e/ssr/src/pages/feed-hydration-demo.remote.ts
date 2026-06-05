import { query } from "kiru/remote"

const feedSchema = {
  parse: (input: unknown) => {
    if (!input || typeof input !== "object") {
      return { sort: "hot" as const }
    }
    const record = input as { sort?: unknown; communitySlug?: unknown }
    const sort = record.sort === "new" ? ("new" as const) : ("hot" as const)
    const communitySlug =
      typeof record.communitySlug === "string" && record.communitySlug
        ? record.communitySlug
        : undefined
    return communitySlug === undefined
      ? { sort }
      : { sort, communitySlug }
  },
}

export type FeedPost = { id: string; title: string; sort: "hot" | "new" }

export type Community = { id: string; slug: string; name: string }

export const getFeed = query(feedSchema, async ({ sort }) => {
  return [{ id: `${sort}-post-1`, title: `${sort} post one`, sort }] satisfies FeedPost[]
})

export const listCommunities = query(async () => {
  return [
    { id: "c-kiru", slug: "kiru", name: "kiru" },
    { id: "c-webdev", slug: "webdev", name: "webdev" },
  ] satisfies Community[]
})

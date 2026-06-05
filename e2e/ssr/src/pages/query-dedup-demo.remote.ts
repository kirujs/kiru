import { query } from "kiru/remote"

const sortSchema = {
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

export type Post = { id: string; label: string }

export const getPosts = query(sortSchema, async ({ sort }) => {
  return [{ id: sort, label: `${sort}-1` }] satisfies Post[]
})

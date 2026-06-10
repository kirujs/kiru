import { query, mutation, getRequestEvent, requested, RemoteError, type Schema } from "kiru/remote"
import { db, hotRank, type Post } from "./server/db.js"
import { isRecord } from "./types.js"

export type FeedSort = "hot" | "new"

export type FeedPost = Post & {
  communitySlug: string
  communityName: string
  authorUsername: string
  authorName: string
}

function enrichPost(post: Post): FeedPost | null {
  const community = db.communities.get(post.communityId)
  const author = db.users.get(post.authorId)
  if (!community || !author) return null
  return {
    ...post,
    communitySlug: community.slug,
    communityName: community.name,
    authorUsername: author.username,
    authorName: author.name,
  }
}

function sortPosts(items: FeedPost[], sort: FeedSort) {
  if (sort === "new") {
    return [...items].sort((a, b) => b.createdAt - a.createdAt)
  }
  return [...items].sort((a, b) => hotRank(b) - hotRank(a))
}

const feedSchema: Schema<{ sort: FeedSort; communitySlug?: string }> = {
  parse: (input) => {
    if (!isRecord(input)) throw new Error("Invalid feed input")
    const sort = input.sort === "new" ? "new" : "hot"
    const communitySlug =
      typeof input.communitySlug === "string" && input.communitySlug
        ? input.communitySlug
        : undefined
    return { sort, communitySlug }
  },
}

export const listCommunities = query(async () => db.communities.list())

const postIdSchema: Schema<{ id: string }> = {
  parse: (input) => {
    if (!isRecord(input)) throw new Error("Invalid")
    const id = String(input.id ?? "").trim()
    if (!id) throw new Error("id required")
    return { id }
  },
}

export const getPost = query(postIdSchema, async ({ id }) => {
  const post = db.posts.get(id)
  if (!post) {
    throw new RemoteError("Post not found", "NOT_FOUND", { status: 404 })
  }
  const base = enrichPost(post)
  if (!base) {
    throw new RemoteError("Post not found", "NOT_FOUND", { status: 404 })
  }
  return base
})

export const getFeed = query(feedSchema, async ({ sort, communitySlug }) => {
  let raw = db.posts.list()
  if (communitySlug) {
    const community = db.communities.getBySlug(communitySlug)
    if (!community) return []
    raw = db.posts.forCommunity(community.id)
  }
  const enriched = raw.map(enrichPost).filter((p): p is FeedPost => p != null)
  return sortPosts(enriched, sort)
})

const communitySlugSchema: Schema<{ slug: string }> = {
  parse: (input) => {
    if (!isRecord(input)) throw new Error("Invalid")
    const slug = String(input.slug ?? "").trim()
    if (!slug) throw new Error("slug required")
    return { slug }
  },
}

export const getCommunity = query(communitySlugSchema, async ({ slug }) => {
  const community = db.communities.getBySlug(slug)
  if (!community) {
    throw new RemoteError("Community not found", "NOT_FOUND", { status: 404 })
  }
  const postCount = db.posts.forCommunity(community.id).length
  return { ...community, postCount }
})

const voteSchema: Schema<{ targetType: "post"; targetId: string; value: 1 | -1 }> = {
  parse: (input) => {
    if (!isRecord(input)) throw new Error("Invalid")
    const targetType = input.targetType === "post" ? "post" : "post"
    const targetId = String(input.targetId ?? "").trim()
    const value = input.value === -1 ? -1 : 1
    if (!targetId) throw new Error("targetId required")
    return { targetType, targetId, value }
  },
}

function requireVoterUserId(): string {
  const { context } = getRequestEvent()
  if (!context.user) {
    throw new RemoteError("Sign in required", "UNAUTHORIZED", { status: 401 })
  }
  const user = db.users.getByUsername(context.user.username)
  if (!user) {
    throw new RemoteError("User not found", "NOT_FOUND", { status: 404 })
  }
  return user.id
}

export const votePost = mutation(voteSchema, async ({ targetType, targetId, value }) => {
  const userId = requireVoterUserId()
  const post = db.posts.get(targetId)
  if (!post) throw new RemoteError("Post not found", "NOT_FOUND", { status: 404 })
  const existing = db.votes.get(userId, targetType, targetId)
  if (existing?.value === value) {
    db.votes.delete(userId, targetType, targetId)
  } else {
    db.votes.set({ userId, targetType, targetId, value })
  }
  post.score = db.votes.scoreFor(targetType, targetId)
  db.posts.set(post)
  await requested(getFeed, 8).refreshAll()
  return { score: post.score }
})

import {
  form,
  getRequestEvent,
  mutation,
  query,
  requested,
  RemoteError,
  redirect,
  type Schema,
} from "kiru/remote"
import type { SandboxUser } from "../server/auth.js"
import { db, hotRank, type Comment, type Post } from "../server/db.js"
import { isRecord } from "../types.js"

export type FeedSort = "hot" | "new"

export type FeedPost = Post & {
  communitySlug: string
  communityName: string
  authorUsername: string
  authorName: string
}

export type PostDetail = FeedPost & {
  comments: Array<
    Comment & { authorUsername: string; authorName: string }
  >
}

function requireUser(user: SandboxUser | null | undefined): SandboxUser {
  if (!user) {
    throw new RemoteError("Sign in required", "UNAUTHORIZED", { status: 401 })
  }
  return user
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

const slugSchema: Schema<{ slug: string }> = {
  parse: (input) => {
    if (!isRecord(input)) throw new Error("Invalid")
    const slug = String(input.slug ?? "").trim()
    if (!slug) throw new Error("slug required")
    return { slug }
  },
}

export const getCommunity = query(slugSchema, async ({ slug }) => {
  const community = db.communities.getBySlug(slug)
  if (!community) {
    throw new RemoteError("Community not found", "NOT_FOUND", { status: 404 })
  }
  const postCount = db.posts.forCommunity(community.id).length
  return { ...community, postCount }
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
  const comments = db.comments.forPost(id).map((c) => {
    const author = db.users.get(c.authorId)!
    return {
      ...c,
      authorUsername: author.username,
      authorName: author.name,
    }
  })
  return { ...base, comments } satisfies PostDetail
})

const usernameSchema: Schema<{ username: string }> = {
  parse: (input) => {
    if (!isRecord(input)) throw new Error("Invalid")
    const username = String(input.username ?? "").trim()
    if (!username) throw new Error("username required")
    return { username }
  },
}

export const getUserProfile = query(usernameSchema, async ({ username }) => {
  const user = db.users.getByUsername(username)
  if (!user) {
    throw new RemoteError("User not found", "NOT_FOUND", { status: 404 })
  }
  const posts = sortPosts(
    db.posts
      .forAuthor(user.id)
      .map(enrichPost)
      .filter((p): p is FeedPost => p != null),
    "new"
  ).slice(0, 10)
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    bio: user.bio,
    avatarUrl: user.avatarUrl,
    postCount: db.posts.forAuthor(user.id).length,
    posts,
  }
})

const createPostSchema: Schema<{ communitySlug: string; title: string; body: string }> = {
  parse: (input) => {
    if (!isRecord(input)) throw new Error("Invalid")
    const communitySlug = String(input.communitySlug ?? "").trim()
    const title = String(input.title ?? "").trim()
    const body = String(input.body ?? "").trim()
    if (!communitySlug || !title || !body) throw new Error("All fields required")
    return { communitySlug, title, body }
  },
}

export const createPost = form(createPostSchema, async (data) => {
  const { context } = getRequestEvent()
  const user = requireUser(context.user)
  const community = db.communities.getBySlug(data.communitySlug)
  if (!community) {
    return { ok: false as const, error: "Community not found" }
  }
  const post: Post = {
    id: crypto.randomUUID(),
    communityId: community.id,
    authorId: user.id,
    title: data.title,
    body: data.body,
    score: 0,
    commentCount: 0,
    createdAt: Date.now(),
  }
  db.posts.set(post)
  await requested(getFeed, 8).refreshAll()
  return redirect(303, `/p/${post.id}`)
})

const commentSchema: Schema<{ postId: string; body: string }> = {
  parse: (input) => {
    if (!isRecord(input)) throw new Error("Invalid")
    const postId = String(input.postId ?? "").trim()
    const body = String(input.body ?? "").trim()
    if (!postId || !body) throw new Error("Invalid comment")
    return { postId, body }
  },
}

export const addComment = form(commentSchema, async (data) => {
  const { context } = getRequestEvent()
  const user = requireUser(context.user)
  const post = db.posts.get(data.postId)
  if (!post) return { ok: false as const, error: "Post not found" }
  const comment: Comment = {
    id: crypto.randomUUID(),
    postId: data.postId,
    authorId: user.id,
    body: data.body,
    score: 0,
    createdAt: Date.now(),
  }
  db.comments.set(comment)
  post.commentCount += 1
  db.posts.set(post)
  await getPost.key({ id: data.postId }).refresh()
  await requested(getFeed, 8).refreshAll()
  return { ok: true as const }
})

const voteSchema: Schema<{ targetType: "post" | "comment"; targetId: string; value: 1 | -1 }> = {
  parse: (input) => {
    if (!isRecord(input)) throw new Error("Invalid")
    const targetType = input.targetType === "comment" ? "comment" : "post"
    const targetId = String(input.targetId ?? "").trim()
    const value = input.value === -1 ? -1 : 1
    if (!targetId) throw new Error("targetId required")
    return { targetType, targetId, value }
  },
}

function applyVote(
  userId: string,
  targetType: "post" | "comment",
  targetId: string,
  value: 1 | -1
) {
  const existing = db.votes.get(userId, targetType, targetId)
  if (existing?.value === value) {
    db.votes.delete(userId, targetType, targetId)
  } else {
    db.votes.set({ userId, targetType, targetId, value })
  }
  const score = db.votes.scoreFor(targetType, targetId)
  if (targetType === "post") {
    const post = db.posts.get(targetId)
    if (post) {
      post.score = score
      db.posts.set(post)
    }
  } else {
    const comment = db.comments.get(targetId)
    if (comment) {
      comment.score = score
      db.comments.set(comment)
    }
  }
  return score
}

export const votePost = mutation(voteSchema, async ({ targetType, targetId, value }) => {
  const { context } = getRequestEvent()
  const user = requireUser(context.user)
  if (targetType !== "post") {
    throw new RemoteError("Use voteComment for comments", "BAD_REQUEST", { status: 400 })
  }
  const post = db.posts.get(targetId)
  if (!post) throw new RemoteError("Post not found", "NOT_FOUND", { status: 404 })
  const score = applyVote(user.id, "post", targetId, value)
  await requested(getFeed, 8).refreshAll()
  await getPost.key({ id: targetId }).refresh()
  return { score }
})

export const voteComment = mutation(voteSchema, async ({ targetType, targetId, value }) => {
  const { context } = getRequestEvent()
  const user = requireUser(context.user)
  if (targetType !== "comment") {
    throw new RemoteError("Use votePost for posts", "BAD_REQUEST", { status: 400 })
  }
  const comment = db.comments.get(targetId)
  if (!comment) throw new RemoteError("Comment not found", "NOT_FOUND", { status: 404 })
  const score = applyVote(user.id, "comment", targetId, value)
  await getPost.key({ id: comment.postId }).refresh()
  return { score }
})

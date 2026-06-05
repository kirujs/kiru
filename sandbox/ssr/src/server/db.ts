/** In-memory store for Threadboard (dev sandbox only). */

export type User = {
  id: string
  username: string
  name: string
  email: string
  bio: string
  avatarUrl: string
  password: string
}

export type Community = {
  id: string
  slug: string
  name: string
  description: string
}

export type Post = {
  id: string
  communityId: string
  authorId: string
  title: string
  body: string
  score: number
  commentCount: number
  createdAt: number
}

export type Comment = {
  id: string
  postId: string
  authorId: string
  body: string
  score: number
  createdAt: number
}

export type VoteTarget = "post" | "comment"

export type Vote = {
  userId: string
  targetType: VoteTarget
  targetId: string
  value: 1 | -1
}

const users = new Map<string, User>()
const communities = new Map<string, Community>()
const posts = new Map<string, Post>()
const comments = new Map<string, Comment>()
const votes = new Map<string, Vote>()

function voteKey(userId: string, targetType: VoteTarget, targetId: string) {
  return `${userId}:${targetType}:${targetId}`
}

export const db = {
  users: {
    get(id: string) {
      return users.get(id)
    },
    getByUsername(username: string) {
      for (const u of users.values()) {
        if (u.username === username) return u
      }
      return undefined
    },
    list() {
      return [...users.values()]
    },
    set(user: User) {
      users.set(user.id, user)
    },
    update(id: string, patch: Partial<Pick<User, "name" | "email" | "bio" | "avatarUrl">>) {
      const u = users.get(id)
      if (!u) return undefined
      Object.assign(u, patch)
      return u
    },
  },
  communities: {
    get(id: string) {
      return communities.get(id)
    },
    getBySlug(slug: string) {
      for (const c of communities.values()) {
        if (c.slug === slug) return c
      }
      return undefined
    },
    list() {
      return [...communities.values()].sort((a, b) => a.name.localeCompare(b.name))
    },
    set(c: Community) {
      communities.set(c.id, c)
    },
  },
  posts: {
    get(id: string) {
      return posts.get(id)
    },
    list() {
      return [...posts.values()]
    },
    set(p: Post) {
      posts.set(p.id, p)
    },
    forCommunity(communityId: string) {
      return [...posts.values()].filter((p) => p.communityId === communityId)
    },
    forAuthor(authorId: string) {
      return [...posts.values()].filter((p) => p.authorId === authorId)
    },
  },
  comments: {
    get(id: string) {
      return comments.get(id)
    },
    forPost(postId: string) {
      return [...comments.values()]
        .filter((c) => c.postId === postId)
        .sort((a, b) => b.score - a.score || a.createdAt - b.createdAt)
    },
    set(c: Comment) {
      comments.set(c.id, c)
    },
  },
  votes: {
    get(userId: string, targetType: VoteTarget, targetId: string) {
      return votes.get(voteKey(userId, targetType, targetId))
    },
    set(v: Vote) {
      votes.set(voteKey(v.userId, v.targetType, v.targetId), v)
    },
    delete(userId: string, targetType: VoteTarget, targetId: string) {
      votes.delete(voteKey(userId, targetType, targetId))
    },
    scoreFor(targetType: VoteTarget, targetId: string) {
      let total = 0
      for (const v of votes.values()) {
        if (v.targetType === targetType && v.targetId === targetId) total += v.value
      }
      return total
    },
  },
  reset() {
    users.clear()
    communities.clear()
    posts.clear()
    comments.clear()
    votes.clear()
  },
}

export function postAgeHours(post: Post, now = Date.now()) {
  return Math.max(1, (now - post.createdAt) / 3_600_000)
}

export function hotRank(post: Post, now = Date.now()) {
  return post.score / postAgeHours(post, now)
}

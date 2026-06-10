/** In-memory store for Threadboard e2e replica. */

export type User = {
  id: string
  username: string
  name: string
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

export type VoteTarget = "post"

export type Vote = {
  userId: string
  targetType: VoteTarget
  targetId: string
  value: 1 | -1
}

const users = new Map<string, User>()
const communities = new Map<string, Community>()
const posts = new Map<string, Post>()
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
    set(u: User) {
      users.set(u.id, u)
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
      return [...communities.values()].sort((a, b) =>
        a.name.localeCompare(b.name)
      )
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
}

export function hotRank(post: Post, now = Date.now()) {
  const hours = Math.max(1, (now - post.createdAt) / 3_600_000)
  return post.score / hours
}

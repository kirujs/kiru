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

const users = new Map<string, User>()
const communities = new Map<string, Community>()
const posts = new Map<string, Post>()

export const db = {
  users: {
    get(id: string) {
      return users.get(id)
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
}

export function hotRank(post: Post, now = Date.now()) {
  const hours = Math.max(1, (now - post.createdAt) / 3_600_000)
  return post.score / hours
}

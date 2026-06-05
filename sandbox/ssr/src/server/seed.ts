import { db, type Comment, type Community, type Post, type User } from "./db.js"

const NOW = Date.UTC(2026, 5, 1, 12, 0, 0)

const users: User[] = [
  {
    id: "demo",
    username: "demo",
    name: "Demo User",
    email: "demo@threadboard.local",
    bio: "Exploring Threadboard on Kiru SSR.",
    avatarUrl: "",
    password: "demo",
  },
  {
    id: "admin",
    username: "admin",
    name: "Admin",
    email: "admin@threadboard.local",
    bio: "Sandbox moderator.",
    avatarUrl: "",
    password: "admin",
  },
  {
    id: "u-alice",
    username: "alice",
    name: "Alice Chen",
    email: "alice@threadboard.local",
    bio: "Full-stack developer.",
    avatarUrl: "",
    password: "alice",
  },
]

const communities: Community[] = [
  {
    id: "c-kiru",
    slug: "kiru",
    name: "kiru",
    description: "Discussions about the Kiru framework — routing, remotes, SSR.",
  },
  {
    id: "c-webdev",
    slug: "webdev",
    name: "webdev",
    description: "Web development patterns, performance, and architecture.",
  },
  {
    id: "c-shower",
    slug: "showerthoughts",
    name: "showerthoughts",
    description: "Mildly interesting ideas from the internet.",
  },
]

function post(
  id: string,
  communityId: string,
  authorId: string,
  title: string,
  body: string,
  hoursAgo: number,
  commentCount = 0
): Post {
  return {
    id,
    communityId,
    authorId,
    title,
    body,
    score: 0,
    commentCount,
    createdAt: NOW - hoursAgo * 3_600_000,
  }
}

const posts: Post[] = [
  post(
    "p-1",
    "c-kiru",
    "demo",
    "How does query cache seeding work with serverLoader?",
    "I keep seeing __kiruQueries in page data — when does the client skip the second POST?",
    2,
    2
  ),
  post(
    "p-2",
    "c-kiru",
    "u-alice",
    "optimistic() vs server .set() for void queries",
    "Void queries now expose factory .optimistic() — feels much closer to SvelteKit.",
    5,
    1
  ),
  post(
    "p-3",
    "c-webdev",
    "admin",
    "Streaming SSR shell with slow loaders",
    "Early head flush + load gate fallback is slick when head only needs route params.",
    8
  ),
  post(
    "p-4",
    "c-webdev",
    "demo",
    "CSR route interceptors for post modals",
    "Feed stays mounted, URL updates for sharing — refresh still renders full page.",
    12,
    3
  ),
  post(
    "p-5",
    "c-shower",
    "u-alice",
    "Every framework demo is someone else's production nightmare",
    "Unless it's Threadboard. Threadboard is fine.",
    1
  ),
  post(
    "p-6",
    "c-kiru",
    "admin",
    "requested() refresh loop in mutation handlers",
    "for (const { query } of requested(getFeed, 4)) await query.refresh() — finally typed correctly.",
    24,
    0
  ),
]

const comments: Comment[] = [
  {
    id: "cm-1",
    postId: "p-1",
    authorId: "admin",
    body: "Loader RPC seeds the cache on client nav; resource() subscribes to the same keys.",
    score: 0,
    createdAt: NOW - 1.5 * 3_600_000,
  },
  {
    id: "cm-2",
    postId: "p-1",
    authorId: "u-alice",
    body: "Check invalidate-demo — void query .set() patches are the simplest path.",
    score: 0,
    createdAt: NOW - 1 * 3_600_000,
  },
  {
    id: "cm-3",
    postId: "p-2",
    authorId: "demo",
    body: "We use it on the voting buttons in Threadboard Phase 4.",
    score: 0,
    createdAt: NOW - 4 * 3_600_000,
  },
  {
    id: "cm-4",
    postId: "p-4",
    authorId: "admin",
    body: "e2e/csr photos intercept spec is the reference implementation.",
    score: 0,
    createdAt: NOW - 10 * 3_600_000,
  },
  {
    id: "cm-5",
    postId: "p-4",
    authorId: "u-alice",
    body: "Direct URL / refresh must render full post for SEO — intercept is CSR-only.",
    score: 0,
    createdAt: NOW - 9 * 3_600_000,
  },
  {
    id: "cm-6",
    postId: "p-4",
    authorId: "demo",
    body: "Link with intercept={false} for open in new tab behavior.",
    score: 0,
    createdAt: NOW - 8.5 * 3_600_000,
  },
]

const votePairs: Array<[string, "post" | "comment", string, 1 | -1]> = [
  ["demo", "post", "p-1", 1],
  ["admin", "post", "p-1", 1],
  ["u-alice", "post", "p-1", 1],
  ["demo", "post", "p-2", 1],
  ["admin", "post", "p-4", 1],
  ["u-alice", "post", "p-4", 1],
  ["demo", "post", "p-5", 1],
  ["admin", "comment", "cm-1", 1],
]

export function seedDatabase() {
  db.reset()
  for (const u of users) db.users.set(u)
  for (const c of communities) db.communities.set(c)
  for (const p of posts) {
    db.posts.set({ ...p, score: 0 })
  }
  for (const c of comments) db.comments.set(c)
  for (const [userId, targetType, targetId, value] of votePairs) {
    db.votes.set({ userId, targetType, targetId, value })
  }
  for (const p of db.posts.list()) {
    p.score = db.votes.scoreFor("post", p.id)
    db.posts.set(p)
  }
  for (const c of comments) {
    const stored = db.comments.get(c.id)!
    stored.score = db.votes.scoreFor("comment", c.id)
    db.comments.set(stored)
  }
}

seedDatabase()

import { db, type Community, type Post, type User } from "./db.js"

const NOW = Date.UTC(2026, 5, 1, 12, 0, 0)

const users: User[] = [
  { id: "demo", username: "demo", name: "Demo User" },
  { id: "e2e", username: "e2e_user", name: "E2E User" },
]

const communities: Community[] = [
  {
    id: "c-kiru",
    slug: "kiru",
    name: "kiru",
    description: "Kiru framework discussions.",
  },
  {
    id: "c-webdev",
    slug: "webdev",
    name: "webdev",
    description: "Web development patterns.",
  },
]

const posts: Post[] = [
  {
    id: "p-1",
    communityId: "c-kiru",
    authorId: "demo",
    title: "How does query cache seeding work with serverLoader?",
    body: "I keep seeing k-data in page data — when does the client skip the second POST?",
    score: 12,
    commentCount: 2,
    createdAt: NOW - 2 * 3_600_000,
  },
  {
    id: "p-2",
    communityId: "c-kiru",
    authorId: "demo",
    title: "optimistic() vs server .set() for void queries",
    body: "Void queries now expose factory .optimistic().",
    score: 8,
    commentCount: 1,
    createdAt: NOW - 5 * 3_600_000,
  },
  {
    id: "p-3",
    communityId: "c-webdev",
    authorId: "demo",
    title: "Streaming SSR shell with slow loaders",
    body: "Early head flush + load gate fallback is slick.",
    score: 5,
    commentCount: 0,
    createdAt: NOW - 8 * 3_600_000,
  },
]

for (const u of users) db.users.set(u)
for (const c of communities) db.communities.set(c)
for (const p of posts) db.posts.set(p)

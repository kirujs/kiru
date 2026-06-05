import { Derive, resource, signal } from "kiru"
import {
  defineHeadContent,
  Link,
  serverLoader,
  type PageProps,
} from "kiru/router"
import { getUserProfile } from "../../feed.remote.js"

export const load = serverLoader(async (ctx) => {
  const username = ctx.params.username
  if (!username) throw new Error("Missing username")
  const profile = await getUserProfile({ username })
  return { profile }
})

export const head = defineHeadContent<typeof load>(async (ctx) => {
  const page = await ctx.loader()
  if (page.error || !page.data) {
    return { title: "Profile — Threadboard" }
  }
  const { profile } = page.data
  return {
    title: `u/${profile.username} — Threadboard`,
    description: profile.bio || `${profile.name} on Threadboard`,
  }
})

export function generateSitemapParams() {
  return [{ username: "demo" }, { username: "alice" }, { username: "admin" }]
}

export default function UserProfilePage({ data, error }: PageProps<typeof load>) {
  const username = data?.profile.username ?? ""
  const usernameSignal = signal(username)
  const profile = resource({
    source: { username: usernameSignal },
    load: getUserProfile,
  })

  if (error) {
    return <p className="text-rose-300">{error.message}</p>
  }

  return () => (
    <Derive from={profile} fallback={<p className="text-slate-400">Loading profile…</p>}>
      {(user) => (
        <div className="space-y-6">
          <header className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
            <h1 className="text-2xl font-bold text-slate-100">u/{user.username}</h1>
            <p className="text-lg text-slate-300">{user.name}</p>
            {user.bio ? <p className="mt-2 text-sm text-slate-400">{user.bio}</p> : null}
            <p className="mt-2 text-xs text-slate-500">{user.postCount} posts</p>
          </header>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-slate-200">Recent posts</h2>
            {user.posts.length === 0 ? (
              <p className="text-slate-500">No posts yet.</p>
            ) : (
              <ul className="space-y-2">
                {user.posts.map((post) => (
                  <li key={post.id}>
                    <Link
                      to="/p/[id]"
                      params={{ id: post.id }}
                      className="text-cyan-300 hover:underline"
                    >
                      {post.title}
                    </Link>
                    <span className="ml-2 text-xs text-slate-500">
                      c/{post.communitySlug} · {post.score} pts
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </Derive>
  )
}

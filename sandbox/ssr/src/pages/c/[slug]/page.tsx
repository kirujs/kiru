import { Derive, resource, signal } from "kiru"
import {
  defineHeadContent,
  Link,
  serverLoader,
  useRequestContext,
  type PageProps,
} from "kiru/router"
import { FeedList } from "../../feed/feed-list.js"
import { getCommunity } from "../../feed.remote.js"
export const load = serverLoader(async (ctx) => {
  const slug = ctx.params.slug
  if (!slug) throw new Error("Missing community")
  const community = await getCommunity({ slug })
  return { community }
})

export const head = defineHeadContent<typeof load>(async (ctx) => {
  const page = await ctx.loader()
  if (page.error || !page.data) {
    return { title: "Community — Threadboard" }
  }
  const { community } = page.data
  return {
    title: `c/${community.slug} — Threadboard`,
    description: community.description,
  }
})

export default function CommunityPage({ data, error }: PageProps<typeof load>) {
  const ctx = useRequestContext()
  const slug = data?.community.slug ?? ""
  const slugSignal = signal(slug)
  const community = resource({
    source: { slug: slugSignal },
    load: getCommunity,
  })

  if (error) {
    return <p className="text-rose-300">{error.message}</p>
  }

  return () => (
    <div className="space-y-4">
      <Derive
        from={community}
        fallback={<p className="text-slate-400">Loading…</p>}
      >
        {(c) => (
          <header className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
            <h1 className="text-2xl font-bold text-orange-400">c/{c.slug}</h1>
            <p className="mt-1 text-slate-300">{c.description}</p>
            <p className="mt-2 text-xs text-slate-500">{c.postCount} posts</p>
            {ctx.user ? (
              <Link
                to="/c/[slug]/submit"
                params={{ slug: c.slug }}
                className="mt-3 inline-block rounded bg-orange-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-orange-500"
              >
                Create post
              </Link>
            ) : null}
          </header>
        )}
      </Derive>
      <FeedList communitySlug={slug} />
    </div>
  )
}

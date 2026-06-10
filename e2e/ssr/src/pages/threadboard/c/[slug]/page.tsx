import { useRouter } from "kiru/router"
import { FeedList } from "../../feed/feed-list.js"

export default function ThreadboardCommunityPage() {
  const router = useRouter()

  return () => {
    const slug = router.params.value.slug
    return (
      <div className="space-y-4" data-testid={`threadboard-community-${slug}`}>
        <header className="rounded-lg border p-4">
          <h1 className="text-2xl font-bold text-orange-400">c/{slug}</h1>
          <p className="mt-1 text-slate-300">Community feed (e2e replica).</p>
        </header>
        <FeedList communitySlug={slug} />
      </div>
    )
  }
}

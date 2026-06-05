import { serverLoader } from "kiru/router"
import { getFeed } from "./feed.remote.js"
import { FeedList } from "./feed/feed-list.js"

export const load = serverLoader(async () => {
  const posts = await getFeed({ sort: "hot" })
  return { posts }
})

export default function ThreadboardHomePage() {
  return (
    <div className="space-y-4" data-testid="threadboard-home">
      <div>
        <h1 className="text-2xl font-bold">Home</h1>
        <p className="text-sm text-slate-400">
          Hot posts across Threadboard (e2e replica).
        </p>
      </div>
      <FeedList />
    </div>
  )
}

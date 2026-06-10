import { FeedList } from "./feed/feed-list.js"

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

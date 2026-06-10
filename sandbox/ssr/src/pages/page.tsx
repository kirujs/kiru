import { FeedList } from "./feed/feed-list.js"

export default function HomePage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Home</h1>
        <p className="text-sm text-slate-400">
          Hot posts across Threadboard. Click a title to open the post modal on
          client navigation.
        </p>
      </div>
      <FeedList />
    </div>
  )
}

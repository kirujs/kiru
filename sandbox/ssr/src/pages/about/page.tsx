import { Link } from "kiru/router"

export default function AboutPage() {
  return (
    <article className="prose prose-invert max-w-none space-y-4 text-slate-300">
      <h1 className="text-2xl font-bold text-slate-100">About Threadboard</h1>
      <p>
        Threadboard is a Reddit-style demo app built on Kiru SSR. It exercises
        real-world patterns: cookie auth, <code>serverLoader</code> + query cache
        seeding, <code>resource()</code>, form and mutation remotes,{" "}
        <code>requested()</code> refresh, <code>optimistic()</code> voting, route
        interceptors for post modals, and hybrid static prerender for this page.
      </p>
      <p>
        Data is in-memory and resets on server restart — suitable for local
        development and framework demos only.
      </p>
      <p>
        <Link to="/" className="text-cyan-300 hover:underline">
          ← Back to feed
        </Link>
      </p>
    </article>
  )
}

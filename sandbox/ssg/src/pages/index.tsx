import { Link } from "kiru/router"

export default function HomePage() {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-slate-900">Welcome</h2>
      <p className="text-slate-700">This page is statically generated.</p>
      <p className="text-sm text-slate-500">
        Build output is generated ahead of time and served as static HTML.
      </p>
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
        <p className="font-medium">Try the SEO examples</p>
        <ul className="mt-2 list-inside list-disc space-y-1">
          <li>
            <Link to="/seo" className="underline">
              SEO overview
            </Link>{" "}
            (JSON-LD, site.config.ts, sitemap)
          </li>
          <li>
            <Link to="/blog/hello/comments/hello-1" className="underline">
              Nested static params
            </Link>
          </li>
        </ul>
      </div>
    </div>
  )
}

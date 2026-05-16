import { Link } from "kiru/router"

export default function SeoSandboxPage() {
  return (
    <div className="space-y-4" data-testid="ssg-seo-page">
      <h2 className="text-xl font-semibold text-slate-900">
        SEO & static paths
      </h2>
      <p className="text-slate-700">
        This sandbox demonstrates Kiru router features used for production
        static sites. After{" "}
        <code className="rounded bg-slate-200 px-1">vite build</code>, check{" "}
        <code className="rounded bg-slate-200 px-1">dist/sitemap.xml</code> and{" "}
        <code className="rounded bg-slate-200 px-1">dist/robots.txt</code> (from{" "}
        <code className="rounded bg-slate-200 px-1">src/site.config.ts</code>).
      </p>
      <ul className="list-inside list-disc space-y-2 text-sm text-slate-600">
        <li>
          <strong>defineSiteConfig</strong> — deployment URL and sitemap/robots
          flags.
        </li>
        <li>
          <strong>head.jsonLd</strong> — view page source for{" "}
          <code className="rounded bg-slate-200 px-1">application/ld+json</code>{" "}
          scripts in &lt;head&gt;.
        </li>
        <li>
          <strong>Nested generateStaticParams</strong> —{" "}
          <Link
            to="/blog/hello/comments/hello-1"
            className="text-emerald-700 underline"
          >
            /blog/hello/comments/hello-1
          </Link>{" "}
          receives parent{" "}
          <code className="rounded bg-slate-200 px-1">slug</code> from the blog
          route.
        </li>
      </ul>
    </div>
  )
}

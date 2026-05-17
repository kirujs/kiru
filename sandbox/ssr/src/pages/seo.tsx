import { defineHeadContent } from "kiru/router"

export const head = defineHeadContent({
  description: "Extra head row merged at render time (SSR only).",
})

export default function SeoSsrPage() {
  return () => (
    <div data-testid="ssr-seo-page" className="space-y-4">
      <h2 className="text-xl font-semibold text-slate-100">SEO on SSR</h2>
      <p className="text-slate-300">
        Route <code className="rounded bg-slate-800 px-1">head.jsonLd</code>{" "}
        is serialized into the server HTML. View page source for{" "}
        <code className="rounded bg-slate-800 px-1">application/ld+json</code>
        .
      </p>
      <p className="text-sm text-slate-400">
        For hybrid apps, add{" "}
        <code className="rounded bg-slate-800 px-1">src/site.config.ts</code>{" "}
        with{" "}
        <code className="rounded bg-slate-800 px-1">defineSiteConfig</code> —
        the Vite plugin emits sitemap/robots at build time for static paths
        (see <code className="rounded bg-slate-800 px-1">dist/client</code>{" "}
        after build).
      </p>
    </div>
  )
}

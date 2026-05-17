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
        <code className="rounded bg-slate-800 px-1">defineSiteConfig</code>.
        The Vite plugin writes sitemap/robots at build time: prerendered{" "}
        <code className="rounded bg-slate-800 px-1">static: true</code> paths,
        all param-less SSR routes when{" "}
        <code className="rounded bg-slate-800 px-1">router.serverEntry</code> is
        set, and dynamic routes listed in{" "}
        <code className="rounded bg-slate-800 px-1">sitemap.include</code> via{" "}
        <code className="rounded bg-slate-800 px-1">generateSitemapParams</code>{" "}
        on the page module.
      </p>
    </div>
  )
}

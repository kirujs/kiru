export default function DocsPage() {
  return (
    <div>
      <p className="text-slate-300" data-testid="sandbox-ssr-docs-static">
        Static docs page (prerendered at build when{" "}
        <code className="text-cyan-300">router.ssg</code> is enabled).
      </p>
    </div>
  )
}

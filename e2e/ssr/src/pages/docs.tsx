import { useRequestContext } from "kiru/router"

export default function DocsPage() {
  const ctx = useRequestContext()
  return (
    <div>
      <p data-testid="ssr-docs-static">Hybrid static docs (prerendered HTML).</p>
      <p data-testid="ssr-docs-user">User: {ctx.user?.name ?? "none"}</p>
    </div>
  )
}

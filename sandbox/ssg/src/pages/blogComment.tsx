import { useRouter } from "kiru/router"
import type { GenerateStaticParamsContext } from "kiru/router"

export function generateStaticParams({ params }: GenerateStaticParamsContext) {
  return [{ id: `${params.slug}-1` }, { id: `${params.slug}-2` }]
}

export default function BlogCommentPage() {
  const router = useRouter()
  return () => (
    <div className="space-y-2" data-testid="blog-comment">
      <h2 className="text-lg font-semibold text-slate-900">Comment</h2>
      <p className="font-mono text-sm text-slate-600">
        {() => `slug=${router.params().slug} id=${router.params().id}`}
      </p>
      <p className="text-sm text-slate-500">
        Child <code>generateStaticParams</code> received the parent slug in{" "}
        <code>ctx.params</code>.
      </p>
    </div>
  )
}

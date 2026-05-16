import { useRouter } from "kiru/router"
import type { GenerateStaticParamsContext } from "kiru/router"

export async function generateStaticParams(_ctx: GenerateStaticParamsContext) {
  return [{ slug: "hello" }, { slug: "kiru" }]
}

export default function BlogSlugPage() {
  const router = useRouter()
  const banner = () => `static:${router.params.value.slug}`
  return () => (
    <div className="space-y-3">
      <h2 className="text-xl font-semibold text-slate-900">Blog Post</h2>
      <p className="text-slate-700">
        Static blog post slug:
        <span className="ml-2 rounded-md bg-emerald-100 px-2 py-1 font-mono text-sm text-emerald-700">
          {() => router.params.value.slug}
        </span>
      </p>
      <p className="rounded-md bg-slate-100 px-3 py-2 font-mono text-sm text-slate-800">
        {() => banner()}
      </p>
    </div>
  )
}

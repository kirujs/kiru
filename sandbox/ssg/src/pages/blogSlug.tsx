import { useRouter } from "kiru/router"

export default function BlogSlugPage() {
  const router = useRouter()
  return () => (
    <div className="space-y-3">
      <h2 className="text-xl font-semibold text-slate-900">Blog Post</h2>
      <p className="text-slate-700">
        Static blog post slug:
        <span className="ml-2 rounded-md bg-emerald-100 px-2 py-1 font-mono text-sm text-emerald-700">
          {() => router.params.value.slug}
        </span>
      </p>
    </div>
  )
}

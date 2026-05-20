import {
  defineHeadContent,
  type GenerateSitemapParamsContext,
  useRouter,
} from "kiru/router"

export const head = defineHeadContent((ctx) => ({
  title: `User ${ctx.params.id} — Kiru SSR`,
}))

export const generateSitemapParams = (_ctx: GenerateSitemapParamsContext) => {
  return [{ id: "1" }, { id: "2" }]
}

export default function UserPage() {
  const router = useRouter()
  return () => (
    <div className="space-y-3">
      <h2 className="text-xl font-semibold text-slate-100">User</h2>
      <p className="text-slate-300">
        SSR user route param id:
        <span className="ml-2 rounded-md bg-cyan-400/20 px-2 py-1 font-mono text-sm text-cyan-200">
          {() => router.params.value.id}
        </span>
      </p>
    </div>
  )
}

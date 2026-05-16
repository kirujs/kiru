import { serverLoader, useRouter, type PageProps } from "kiru/router"

/** SSR demo: `serverLoader` on `/demo-loader`. */
export const load = serverLoader(async (ctx) => {
  await new Promise((resolve) => setTimeout(resolve, 1000))
  return {
    pathname: ctx.url.pathname,
    note: "Serialized in document head for hydration",
  }
})

export default function DemoRoutePage({ data, error }: PageProps<typeof load>) {
  const router = useRouter()
  return () => (
    <div className="space-y-3">
      <h2 className="text-xl font-semibold text-slate-100">Route demo</h2>
      <p className="text-slate-300">
        Current path:{" "}
        <span className="font-mono text-cyan-200">{() => router.pathname.value}</span>
      </p>
      <p className="text-slate-300" data-testid="loader-data">
        Loader:{" "}
        {error ? error.message : `${data.pathname} — ${data.note}`}
      </p>
    </div>
  )
}

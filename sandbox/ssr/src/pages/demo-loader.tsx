import { useRouter } from "kiru/router"

/** Demo route without async loaders — uses the live router for the current path. */
export default function DemoRoutePage() {
  const router = useRouter()
  return (
    <div className="space-y-3">
      <h2 className="text-xl font-semibold text-slate-100">Route demo</h2>
      <p className="text-slate-300">
        Current path:{" "}
        <span className="font-mono text-cyan-200">
          {() => router.pathname.peek()}
        </span>
      </p>
    </div>
  )
}

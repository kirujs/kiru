import { useRequestContext } from "kiru/router"

export default function HomePage() {
  const { user } = useRequestContext()
  return (
    <div className="space-y-3">
      <h2 className="text-xl font-semibold text-slate-100">Home</h2>
      <p className="text-slate-300">
        This page is server-rendered by `createRenderer`.
      </p>
      <p className="text-slate-300">
        User:
        <span className="ml-2 rounded-md bg-cyan-400/20 px-2 py-1 font-medium text-cyan-200">
          {user?.name ?? "n/a"}
        </span>
      </p>
    </div>
  )
}

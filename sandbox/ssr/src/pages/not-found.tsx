import { Link } from "kiru/router"

export default function NotFoundPage() {
  return (
    <div className="mx-auto max-w-md space-y-4 text-center">
      <h1 className="text-4xl font-bold text-slate-100">404</h1>
      <p className="text-slate-400">This page does not exist on Threadboard.</p>
      <Link
        to="/"
        className="inline-block rounded-full bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-500"
      >
        Back to feed
      </Link>
    </div>
  )
}

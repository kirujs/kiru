import { Link } from "kiru/router"

export default function Layout({ children }: { children: JSX.Children }) {
  return (
    <div className="mx-auto max-w-lg space-y-4 p-6 font-sans">
      <h1 className="text-2xl font-semibold text-slate-900">Kiru CSR sandbox</h1>
      <nav className="flex flex-wrap gap-2 text-sm">
        <Link className="text-blue-600 underline" to="/">
          Home
        </Link>
        <Link className="text-blue-600 underline" to="/about">
          About
        </Link>
        <Link className="text-blue-600 underline" to="/navigation">
          Navigation API
        </Link>
      </nav>
      <div className="rounded border border-slate-200 bg-white p-4 shadow-sm">
        {children}
      </div>
    </div>
  )
}

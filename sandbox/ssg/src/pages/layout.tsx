import { Link } from "kiru/router"

export default function Layout({ children }: { children: JSX.Children }) {
  return (
    <main className="min-h-screen bg-slate-50 p-6 text-slate-900 md:p-10">
      <div className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
        <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600">
          Static Site Generation
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">
          Kiru SSG Sandbox
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Tailwind CSS v4 is configured with the Vite plugin.
        </p>
        <nav className="mt-6 flex flex-wrap gap-2">
          <Link
            to="/"
            className="rounded-full border border-slate-300 px-3 py-1 text-sm font-medium text-slate-700 hover:border-emerald-300 hover:text-emerald-700"
          >
            Home
          </Link>
          <Link
            to="/about"
            className="rounded-full border border-slate-300 px-3 py-1 text-sm font-medium text-slate-700 hover:border-emerald-300 hover:text-emerald-700"
          >
            About
          </Link>
          <Link
            to="/blog/hello"
            className="rounded-full border border-slate-300 px-3 py-1 text-sm font-medium text-slate-700 hover:border-emerald-300 hover:text-emerald-700"
          >
            Blog: hello
          </Link>
          <Link
            to="/blog/kiru"
            className="rounded-full border border-slate-300 px-3 py-1 text-sm font-medium text-slate-700 hover:border-emerald-300 hover:text-emerald-700"
          >
            Blog: kiru
          </Link>
          <Link
            to="/seo"
            className="rounded-full border border-emerald-600 bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-800 hover:bg-emerald-100"
          >
            SEO
          </Link>
          <Link
            to="/blog/hello/comments/hello-1"
            className="rounded-full border border-slate-300 px-3 py-1 text-sm font-medium text-slate-700 hover:border-emerald-300 hover:text-emerald-700"
          >
            Nested static
          </Link>
        </nav>
        <section className="mt-8 rounded-xl border border-slate-200 bg-slate-50 p-4 md:p-6">
          {children}
        </section>
      </div>
    </main>
  )
}

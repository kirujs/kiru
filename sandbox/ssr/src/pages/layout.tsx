import { Derive, resource } from "kiru"
import { defineInterceptors, Link, useRequestContext } from "kiru/router"
import { logoutForm } from "./auth.remote.js"
import { createFormController } from "kiru/remote"
import { listCommunities, getPost } from "./feed.remote.js"
import { LoginModal } from "./auth/login-modal.js"
import { PostModal } from "./p/post-modal.js"

export const interceptors = defineInterceptors({
  login: {
    path: "/login",
    render: ({ restore }) => <LoginModal onClose={restore} />,
  },
  post: {
    path: "/p/[id]",
    load: async ({ params }) => {
      const id = params.id
      const post = await getPost({ id })
      return { title: post.title }
    },
    render: ({ params, data, error, restore, reload }) =>
      error ? (
        <div className="rounded-lg border border-rose-800 bg-rose-950/50 p-4">
          <p>{error.message}</p>
          <button
            type="button"
            onclick={reload}
            className="mt-2 text-sm text-cyan-300"
          >
            Retry
          </button>
        </div>
      ) : (
        <PostModal
          postId={params.id}
          title={data.title ?? "Post"}
          onClose={restore}
        />
      ),
  },
})

export default function Layout() {
  const ctx = useRequestContext()
  const logout = createFormController(logoutForm)
  const communities = resource(() => listCommunities())

  return ({ children }: { children: JSX.Children }) => (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/80">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Link
            to="/"
            className="text-lg font-bold text-orange-400 hover:text-orange-300"
          >
            Threadboard
          </Link>
          <nav className="flex items-center gap-3 text-sm">
            {ctx.user ? (
              <>
                <Link
                  to="/settings"
                  className="text-slate-300 hover:text-white"
                >
                  u/{ctx.user.username}
                </Link>
                <form
                  action={logout.action}
                  method={logout.method}
                  onsubmit={logout.onsubmit}
                >
                  <button
                    type="submit"
                    className="text-slate-500 hover:text-rose-300"
                  >
                    Sign out
                  </button>
                </form>
              </>
            ) : (
              <Link
                to="/login"
                className="rounded-full bg-orange-600 px-3 py-1 font-medium text-white hover:bg-orange-500"
              >
                Sign in
              </Link>
            )}
          </nav>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 md:grid-cols-[220px_1fr]">
        <aside className="hidden md:block" data-testid="communities-sidebar">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Communities
          </h2>
          <Derive
            from={communities}
            fallback={<p className="text-sm text-slate-500">Loading…</p>}
          >
            {(list) => (
              <ul className="space-y-1 text-sm">
                {list.map((c) => (
                  <li key={c.id} data-testid={`community-${c.slug}`}>
                    <Link
                      to="/c/[slug]"
                      params={{ slug: c.slug }}
                      className="block rounded px-2 py-1 text-slate-300 hover:bg-slate-800 hover:text-white"
                    >
                      c/{c.slug}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Derive>
          <p className="mt-6 text-xs text-slate-600">
            <Link to="/about" className="hover:text-slate-400">
              About
            </Link>
          </p>
        </aside>

        <main>{children}</main>
      </div>
    </div>
  )
}

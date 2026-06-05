import { Derive, resource } from "kiru"
import { defineInterceptors, Link, useRequestContext } from "kiru/router"
import { listCommunities, getPost } from "./feed.remote.js"
import { LoginModal } from "./login-modal.js"
import { PostModal } from "./post-modal.js"

export const interceptors = defineInterceptors({
  login: {
    path: "/threadboard/login",
    render: ({ restore }) => <LoginModal onClose={restore} />,
  },
  post: {
    path: "/threadboard/p/[id]",
    load: async ({ params }) => {
      const id = (params as { id: string }).id
      const post = await getPost({ id })
      return { title: post.title }
    },
    render: ({ params, data, error, restore, reload }) =>
      error ? (
        <div data-testid="post-interceptor-error">
          <p>{error.message}</p>
          <button type="button" onclick={reload}>
            Retry
          </button>
        </div>
      ) : (
        <PostModal
          postId={(params as { id: string }).id}
          title={(data as { title: string } | undefined)?.title ?? "Post"}
          onClose={restore}
        />
      ),
  },
})

export default function ThreadboardLayout() {
  const ctx = useRequestContext()
  const communities = resource(() => listCommunities())

  return ({ children }: { children: JSX.Children }) => (
    <div
      className="min-h-screen bg-slate-950 text-slate-100"
      data-testid="threadboard-layout"
    >
      <header className="border-b border-slate-800">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Link
            to="/threadboard"
            className="text-lg font-bold text-orange-400 hover:text-orange-300"
          >
            Threadboard
          </Link>
          <nav className="flex items-center gap-3 text-sm">
            {ctx.user ? (
              <span data-testid="threadboard-user">
                u/{ctx.user.username ?? ctx.user.name}
              </span>
            ) : (
              <Link
                to="/threadboard/login"
                className="rounded-full bg-orange-600 px-3 py-1 font-medium text-white"
              >
                Sign in
              </Link>
            )}
          </nav>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 md:grid-cols-[220px_1fr]">
        <aside className="md:block" data-testid="communities-sidebar">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Communities
          </h2>
          <Derive
            from={communities}
            fallback={
              <p className="text-sm text-slate-500" data-testid="communities-fallback">
                Loading…
              </p>
            }
          >
            {(list) => (
              <ul className="space-y-1 text-sm" data-testid="communities-list">
                {list.map((c) => (
                  <li key={c.id} data-testid={`community-${c.slug}`}>
                    <Link
                      to="/threadboard"
                      className="block rounded px-2 py-1 text-slate-300 hover:bg-slate-800"
                    >
                      c/{c.slug}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Derive>
        </aside>

        <main>{children}</main>
      </div>
    </div>
  )
}

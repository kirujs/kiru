import { defineInterceptors, Link, useRequestContext } from "kiru/router"
import { getPost } from "./feed.remote.js"
import { LoginModal } from "./login-modal.js"
import { PostModal } from "./post-modal.js"
import { CommunitiesSidebar } from "./communities-sidebar.js"

export const interceptors = defineInterceptors({
  login: {
    path: "/threadboard/login",
    render: ({ restore }) => <LoginModal onClose={restore} />,
  },
  post: {
    path: "/threadboard/p/[id]",
    load: async ({ params }) => {
      const id = params.id
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
        <PostModal postId={params.id} title={data.title} onClose={restore} />
      ),
  },
})

export default function ThreadboardLayout() {
  const ctx = useRequestContext()

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
                data-testid="threadboard-sign-in"
              >
                Sign in
              </Link>
            )}
          </nav>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 md:grid-cols-[220px_1fr]">
        <CommunitiesSidebar />
        <main>{children}</main>
      </div>
      <p className="mx-auto max-w-6xl px-4 pb-6 text-xs text-slate-600">
        <Link to="/threadboard/about" data-testid="threadboard-about-link">
          About
        </Link>
      </p>
    </div>
  )
}

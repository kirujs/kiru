import { createFormController } from "kiru/remote"
import { Link, useRouter } from "kiru/router"
import { createPost } from "../../../feed.remote.js"

export default function SubmitPostPage() {
  const router = useRouter()
  const form = createFormController(createPost)

  return () => {
    const slug = router.params.value.slug ?? ""
    return (
      <div className="mx-auto max-w-xl space-y-4">
        <h1 className="text-xl font-semibold text-slate-100">
          Create post in c/{slug}
        </h1>
        <form
          className="space-y-3 rounded-lg border border-slate-800 bg-slate-950/50 p-4"
          action={form.action}
          method={form.method}
          onsubmit={form.onsubmit}
        >
          <input type="hidden" name="communitySlug" value={slug} />
          <label className="block text-sm text-slate-300">
            Title
            <input
              name="title"
              type="text"
              className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
            />
          </label>
          <label className="block text-sm text-slate-300">
            Body
            <textarea
              name="body"
              rows={8}
              className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
            />
          </label>
          {form.error.value ? (
            <p className="text-sm text-rose-300">{form.error.value}</p>
          ) : null}
          <div className="flex gap-2">
            <button
              type="submit"
              className="rounded bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-500"
              disabled={form.isPending.value}
            >
              {form.isPending.value ? "Posting…" : "Publish"}
            </button>
            <Link
              to="/c/[slug]"
              params={{ slug }}
              className="rounded border border-slate-600 px-4 py-2 text-sm text-slate-300 hover:border-slate-500"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    )
  }
}

import { Derive, resource } from "kiru"
import { Link } from "kiru/router"
import { listCommunities } from "./feed.remote.js"

export function CommunitiesSidebar() {
  const communities = resource({
    load: listCommunities,
    defaultState: [],
  })

  return () => (
    <aside className="md:block" data-testid="communities-sidebar">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
        Communities
      </h2>
      <Derive
        from={communities}
        fallback={
          <p
            className="text-sm text-slate-500"
            data-testid="communities-fallback"
          >
            Loading…
          </p>
        }
      >
        {(list) => (
          <ul className="space-y-1 text-sm" data-testid="communities-list">
            {list.map((c) => (
              <li key={c.id} data-testid={`community-${c.slug}`}>
                <Link
                  to="/threadboard/c/[slug]"
                  params={{ slug: c.slug }}
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
  )
}

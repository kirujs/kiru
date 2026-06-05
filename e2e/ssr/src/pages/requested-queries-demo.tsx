import { Derive, resource, signal } from "kiru"
import { createFormController } from "kiru/remote"
import {
  addItem,
  listFiltered,
  type CatalogItem,
} from "./requested-queries-demo.remote.js"

export default function RequestedQueriesDemoPage() {
  const filter = signal("work")
  const items = resource({
    source: { filter },
    load: listFiltered,
    defaultState: [] as CatalogItem[],
  })
  const form = createFormController(addItem, { updates: [listFiltered] })

  async function onFilterChange(next: string) {
    filter.value = next
  }

  async function onAdd(event: Kiru.SubmitEvent<HTMLFormElement>) {
    if (event.defaultPrevented) return
    event.preventDefault()
    await form
      .submit(event.currentTarget)
      .updates(listFiltered, listFiltered.key({ filter: filter.value }))
  }

  return () => (
    <section data-testid="requested-queries-demo">
      <h2>Client-requested query refresh</h2>
      <p data-testid="requested-filter">Filter: {filter.value}</p>
      <div className="flex gap-2">
        <button
          type="button"
          data-testid="requested-filter-work"
          onclick={() => onFilterChange("work")}
        >
          Work
        </button>
        <button
          type="button"
          data-testid="requested-filter-play"
          onclick={() => onFilterChange("play")}
        >
          Play
        </button>
      </div>

      <Derive
        from={items}
        fallback={<p data-testid="requested-loading">Loading…</p>}
      >
        {(list: CatalogItem[]) => (
          <ul data-testid="requested-list">
            {list.map((item: CatalogItem) => (
              <li key={item.id} data-testid="requested-item">
                {item.label}
              </li>
            ))}
          </ul>
        )}
      </Derive>

      <form
        data-testid="requested-form"
        action={form.action}
        method={form.method}
        onsubmit={onAdd}
      >
        <input name="label" type="text" placeholder="Label" />
        <input name="tag" type="hidden" value={filter.value} />
        <button data-testid="requested-add" type="submit">
          Add
        </button>
      </form>
    </section>
  )
}

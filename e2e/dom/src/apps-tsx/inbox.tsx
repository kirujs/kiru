"use dom"

import { computed, For, mount, signal, type DomAppHandle } from "kiru/dom"

export function mountInbox(container: HTMLElement): DomAppHandle {
  return mount(() => <InboxApp />, container)
}

interface InboxItem {
  id: string
  text: string
  done: boolean
}

type Filter = "all" | "active" | "done"

let nextId = 1

function InboxApp() {
  const draft = signal("")
  const filter = signal<Filter>("all")
  const items = signal<InboxItem[]>([])

  const filtered = computed(() => {
    const list = items()
    const f = filter()
    if (f === "active") return list.filter((i) => !i.done)
    if (f === "done") return list.filter((i) => i.done)
    return list
  })

  function addItem() {
    const text = draft().trim()
    if (!text) return
    items.set([...items(), { id: String(nextId++), text, done: false }])
    draft.set("")
  }

  return () => (
    <div data-testid="inbox-app">
      <div className="inbox-toolbar">
        <input
          data-testid="inbox-input"
          type="text"
          placeholder="New item"
          bind:value={draft}
        />
        <button type="button" data-testid="inbox-add" onclick={addItem}>
          Add
        </button>
      </div>
      <nav className="inbox-filters" data-testid="inbox-filters">
        <button
          type="button"
          data-testid="filter-all"
          className={filter() === "all" ? "active" : ""}
          onclick={() => filter.set("all")}
        >
          All
        </button>
        <button
          type="button"
          data-testid="filter-active"
          className={filter() === "active" ? "active" : ""}
          onclick={() => filter.set("active")}
        >
          Active
        </button>
        <button
          type="button"
          data-testid="filter-done"
          className={filter() === "done" ? "active" : ""}
          onclick={() => filter.set("done")}
        >
          Done
        </button>
      </nav>
      <ul data-testid="inbox-list">
        <For
          each={filtered}
          key={(item) => item.id}
          fallback={<p data-testid="inbox-empty">No items</p>}
        >
          {(item) => (
            <li className="inbox-row">
              <input
                type="checkbox"
                className="inbox-done"
                checked={item.done}
                onchange={(e) => {
                  const checked = (e.target as HTMLInputElement).checked
                  items.set(
                    items().map((t) =>
                      t.id === item.id ? { ...t, done: checked } : t
                    )
                  )
                }}
              />
              <span className="inbox-text">{item.text}</span>
              <button
                type="button"
                className="inbox-archive"
                onclick={() =>
                  items.set(items().filter((t) => t.id !== item.id))
                }
              >
                Archive
              </button>
              <button
                type="button"
                className="inbox-delete"
                onclick={() =>
                  items.set(items().filter((t) => t.id !== item.id))
                }
              >
                Delete
              </button>
            </li>
          )}
        </For>
      </ul>
    </div>
  )
}

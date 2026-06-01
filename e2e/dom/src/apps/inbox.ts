/*
 * ── Source (author JSX) ─────────────────────────────────────
 *
 * function InboxApp() {
 *   const draft = signal("")
 *   const filter = signal<"all" | "active" | "done">("all")
 *   const items = signal<InboxItem[]>([])
 *   const filtered = computed(() => items().filter(by filter))
 *   const isEmpty = computed(() => filtered().length === 0)
 *
 *   function addItem() { … draft() … draft.set("") }
 *
 *   return () => (
 *     <div data-testid="inbox-app">
 *       <input data-testid="inbox-input" bind:value={draft} />
 *       <button data-testid="inbox-add" onclick={addItem}>Add</button>
 *       <nav data-testid="inbox-filters">
 *         <button data-testid="filter-all" onclick={() => filter.set("all")}>All</button>
 *         <button data-testid="filter-active" onclick={() => filter.set("active")}>Active</button>
 *         <button data-testid="filter-done" onclick={() => filter.set("done")}>Done</button>
 *       </nav>
 *       <ul data-testid="inbox-list">
 *         <For each={filtered} key={item => item.id} fallback={<p data-testid="inbox-empty">…</p>}>…</For>
 *       </ul>
 *     </div>
 *   )
 * }
 *
 * ── Compiler output (emitted) ───────────────────────────────
 */

import {
  bindValue,
  clone,
  computed,
  createComponent,
  domEffect,
  For,
  mount,
  on,
  project,
  signal,
  template,
  type DomAppHandle,
} from "kiru/dom"

type InboxItem = {
  id: string
  text: string
  done: boolean
}

type Filter = "all" | "active" | "done"

const $t0 = template(`<div data-testid="inbox-app">
  <div class="inbox-toolbar">
    <input data-testid="inbox-input" type="text" placeholder="New item" />
    <button type="button" data-testid="inbox-add">Add</button>
  </div>
  <nav class="inbox-filters" data-testid="inbox-filters">
    <button type="button" data-testid="filter-all">All</button>
    <button type="button" data-testid="filter-active">Active</button>
    <button type="button" data-testid="filter-done">Done</button>
  </nav>
  <ul data-testid="inbox-list"><!--#--></ul>
</div>`, 1)

const $t1 = template(`<p data-testid="inbox-empty">No items</p>`)

const $t2 = template(`<li class="inbox-row">
  <input type="checkbox" class="inbox-done" />
  <span class="inbox-text"></span>
  <button type="button" class="inbox-archive">Archive</button>
  <button type="button" class="inbox-delete">Delete</button>
</li>`)

let nextId = 1

export function mountInbox(container: HTMLElement): DomAppHandle {
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

  return mount(() => {
    const $el0 = clone($t0)
    const $n0 = project($t0, $el0)
    // nodes[0]=toolbar div, [1]=input, [2]=add btn, [3]=nav, [4]=filter-all, [5]=active, [6]=done, [7]=list ul
    const input = $n0.nodes[1] as HTMLInputElement
    const addBtn = $n0.nodes[2]!
    const filterAll = $n0.nodes[4]!
    const filterActive = $n0.nodes[5]!
    const filterDone = $n0.nodes[6]!
    bindValue(input, draft)

    function addItem() {
      const text = draft().trim()
      if (!text) return
      items.set([...items(), { id: String(nextId++), text, done: false }])
      draft.set("")
    }

    on(addBtn, "click", addItem)

    function setFilter(next: Filter) {
      filter.set(next)
    }

    on(filterAll, "click", () => setFilter("all"))
    on(filterActive, "click", () => setFilter("active"))
    on(filterDone, "click", () => setFilter("done"))

    domEffect(() => {
      const f = filter()
      filterAll.classList.toggle("active", f === "all")
      filterActive.classList.toggle("active", f === "active")
      filterDone.classList.toggle("active", f === "done")
    })

    createComponent(
      For,
      {
        each: filtered,
        key: (item: InboxItem) => item.id,
        fallback: () => clone($t1),
        children: (item: InboxItem) =>
          createComponent(() => {
            const $el2 = clone($t2)
            const $n2 = project($t2, $el2)
            const checkbox = $n2.nodes[0] as HTMLInputElement
            const textEl = $n2.nodes[1]!
            const archiveBtn = $n2.nodes[2]!
            const deleteBtn = $n2.nodes[3]!

            domEffect(() => {
              const current = items().find((t) => t.id === item.id)
              checkbox.checked = current?.done ?? false
            })
            textEl.textContent = item.text

            on(checkbox, "change", () => {
              items.set(
                items().map((t) =>
                  t.id === item.id ? { ...t, done: checkbox.checked } : t
                )
              )
            })
            on(archiveBtn, "click", () => {
              items.set(items().filter((t) => t.id !== item.id))
            })
            on(deleteBtn, "click", () => {
              items.set(items().filter((t) => t.id !== item.id))
            })

            return $el2
          }, {}),
      },
      $n0.anchors[0]!
    )

    return $el0
  }, container)
}
